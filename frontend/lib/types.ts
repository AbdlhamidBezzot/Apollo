export interface Title {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  runtime?: number;
}

export interface ContentListResponse {
  page: number;
  results: Title[];
  total_pages: number;
  total_results: number;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface Episode {
  episode_number: number;
  season_number: number;
  name?: string;
  overview?: string;
  air_date?: string | null;
  still_path?: string | null;
  vote_average?: number;
  runtime?: number | null;
  meta?: EpisodeMeta;
}

export interface SeasonEpisodes {
  id?: number;
  name?: string;
  overview?: string;
  episodes?: Episode[];
}

export interface TitleDetail extends Title {
  credits?: { cast?: CastMember[]; crew?: { id: number; name: string; job: string }[] };
  videos?: { results?: { key: string; site: string; name: string; type: string }[] };
  runtime?: number;
  genres?: { id: number; name: string }[];
  vote_count?: number;
  tagline?: string;
  status?: string;
  season_number?: number;
  number_of_seasons?: number;
  seasons?: { season_number: number; name?: string; episode_count?: number; air_date?: string | null }[];
}

export interface SuggestedTitle {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  pitch: string;
}

export interface ChatResponse {
  reply: string;
  suggested_titles: SuggestedTitle[];
  session_id: number | null;
  action: "none" | "play";
  play_target: {
    tmdb_id: number;
    media_type: "movie" | "tv";
    stream_url: string;
    content_type: string;
    expires_at: string;
    poster: string | null;
    title: string | null;
  } | null;
}

export interface PlaybackSession {
  provider: string;
  stream_url: string;
  content_type: string;
  expires_at: string;
  poster: string | null;
  title: string | null;
  session_token?: string | null;
}

export interface User {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  email_verified: boolean;
}

export interface Genre {
  id: number;
  name: string;
}

export interface PlaybackCue {
  tmdb_id: number;
  media_type: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  intro_start?: number | null;
  intro_end?: number | null;
  outro_start?: number | null;
  outro_end?: number | null;
}

export interface EpisodeMeta {
  is_filler: boolean;
  is_canon: boolean;
  arc_name?: string | null;
  audio_languages?: string[];
}

export interface MovieNightRoomInfo {
  code: string;
  tmdb_id?: number | null;
  media_type?: "movie" | "tv" | null;
  season?: number | null;
  episode?: number | null;
  members: number;
  host?: string | null;
}

export interface RoomParticipant {
  name: string;
  is_host: boolean;
  has_preferences: boolean;
  preferences_pending: boolean;
}

export interface MovieNightRoomDetail {
  code: string;
  status: "collecting" | "deciding" | "decided";
  host_name: string;
  participants: RoomParticipant[];
  created_at: string;
}

export interface RoomCreateResponse {
  code: string;
  status: string;
  token: string;
  is_host: boolean;
}

export interface MovieNightJoinResponse {
  room: MovieNightRoomDetail;
  token: string;
  is_host: boolean;
}

export interface RoomPreferences {
  favorite_genres: number[];
  excluded_genres: number[];
  max_runtime_minutes?: number | null;
  mood?: string | null;
  intensity?: number | null;
}

export interface MovieNightSuggestResponse {
  reply: string;
  suggested_titles: SuggestedTitle[];
  status: string;
}

export interface MovieNightDecideResponse {
  reply: string;
  action: "none" | "play";
  play_target: {
    tmdb_id: number;
    media_type: "movie" | "tv";
    stream_url: string;
    content_type: string;
    expires_at: string;
    poster: string | null;
    title: string | null;
  } | null;
}

export interface RoomChatMessage {
  sender: string;
  text: string;
  time?: string;
}
