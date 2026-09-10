"""Comments and title reactions routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.ratelimit import rate_limited
from app.db import get_db
from app.models import CommentLike, MediaComment, MediaReaction, Profile, User
from app.schemas import (
    CommentCreate,
    CommentOut,
    MediaReactionCreate,
    MediaReactionOut,
)

from ..deps import CurrentProfile, CurrentUser, CurrentUserOptional

router = APIRouter(prefix="", tags=["comments"])

settings = get_settings()
DbDep = Annotated[Session, Depends(get_db)]
_rl_comments = rate_limited("comments", settings.rate_limit_me)


# --- Comments ---
@router.get("/comments/{media_type}/{tmdb_id}", response_model=list[CommentOut])
async def list_comments(media_type: str, tmdb_id: int, db: DbDep, user: CurrentUserOptional = None):
    comments = (
        db.query(MediaComment)
        .filter(MediaComment.media_type == media_type, MediaComment.tmdb_id == tmdb_id)
        .order_by(MediaComment.created_at.desc())
        .limit(100)
        .all()
    )

    user_liked_comment_ids: set[int] = set()
    if user:
        comment_ids = [c.id for c in comments]
        if comment_ids:
            liked_rows = (
                db.query(CommentLike.comment_id)
                .filter(CommentLike.user_id == user.id, CommentLike.comment_id.in_(comment_ids))
                .all()
            )
            user_liked_comment_ids = {r[0] for r in liked_rows}

    res: list[CommentOut] = []
    for c in comments:
        author_name = c.profile.display_name if c.profile else (c.user.name if c.user else "Anonymous")
        author_avatar = c.profile.avatar if c.profile else None
        res.append(
            CommentOut(
                id=c.id,
                user_id=c.user_id,
                tmdb_id=c.tmdb_id,
                media_type=c.media_type,
                text=c.text,
                author_name=author_name,
                author_avatar=author_avatar,
                created_at=c.created_at,
                likes_count=len(c.likes),
                is_liked=c.id in user_liked_comment_ids,
            )
        )
    return res


@router.post("/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    payload: CommentCreate,
    user: CurrentUser,
    profile: CurrentProfile,
    db: DbDep,
    _rl=Depends(_rl_comments),
):
    comment = MediaComment(
        user_id=user.id,
        profile_id=profile.id,
        tmdb_id=payload.tmdb_id,
        media_type=payload.media_type,
        text=payload.text.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentOut(
        id=comment.id,
        user_id=comment.user_id,
        tmdb_id=comment.tmdb_id,
        media_type=comment.media_type,
        text=comment.text,
        author_name=profile.display_name or user.name,
        author_avatar=profile.avatar,
        created_at=comment.created_at,
        likes_count=0,
        is_liked=False,
    )


@router.post("/comments/{comment_id}/like")
async def toggle_comment_like(
    comment_id: int,
    user: CurrentUser,
    db: DbDep,
):
    comment = db.query(MediaComment).filter(MediaComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = (
        db.query(CommentLike)
        .filter(CommentLike.user_id == user.id, CommentLike.comment_id == comment_id)
        .first()
    )
    if existing:
        db.delete(existing)
        liked = False
    else:
        like = CommentLike(user_id=user.id, comment_id=comment_id)
        db.add(like)
        liked = True

    db.commit()
    likes_count = db.query(CommentLike).filter(CommentLike.comment_id == comment_id).count()
    return {"liked": liked, "likes_count": likes_count}


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(comment_id: int, user: CurrentUser, db: DbDep):
    comment = db.query(MediaComment).filter(MediaComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    db.delete(comment)
    db.commit()


# --- Media Reactions (Likes / Dislikes) ---
@router.get("/reactions/{media_type}/{tmdb_id}", response_model=MediaReactionOut)
async def get_media_reactions(
    media_type: str,
    tmdb_id: int,
    db: DbDep,
    user: CurrentUserOptional = None,
):
    likes_count = (
        db.query(MediaReaction)
        .filter(
            MediaReaction.media_type == media_type,
            MediaReaction.tmdb_id == tmdb_id,
            MediaReaction.reaction == "like",
        )
        .count()
    )

    dislikes_count = (
        db.query(MediaReaction)
        .filter(
            MediaReaction.media_type == media_type,
            MediaReaction.tmdb_id == tmdb_id,
            MediaReaction.reaction == "dislike",
        )
        .count()
    )

    user_reaction = None
    if user:
        reaction_row = (
            db.query(MediaReaction)
            .filter(
                MediaReaction.user_id == user.id,
                MediaReaction.media_type == media_type,
                MediaReaction.tmdb_id == tmdb_id,
            )
            .first()
        )
        if reaction_row:
            user_reaction = reaction_row.reaction

    return MediaReactionOut(
        likes_count=likes_count,
        dislikes_count=dislikes_count,
        user_reaction=user_reaction,
    )


@router.post("/reactions", response_model=MediaReactionOut)
async def set_media_reaction(
    payload: MediaReactionCreate,
    user: CurrentUser,
    profile: CurrentProfile,
    db: DbDep,
):
    existing = (
        db.query(MediaReaction)
        .filter(
            MediaReaction.user_id == user.id,
            MediaReaction.media_type == payload.media_type,
            MediaReaction.tmdb_id == payload.tmdb_id,
        )
        .first()
    )

    if payload.reaction == "none":
        if existing:
            db.delete(existing)
            db.commit()
    else:
        if existing:
            existing.reaction = payload.reaction
        else:
            rx = MediaReaction(
                user_id=user.id,
                profile_id=profile.id,
                tmdb_id=payload.tmdb_id,
                media_type=payload.media_type,
                reaction=payload.reaction,
            )
            db.add(rx)
        db.commit()

    return await get_media_reactions(
        media_type=payload.media_type, tmdb_id=payload.tmdb_id, db=db, user=user
    )
