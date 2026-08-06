"use client";

export function MovieNightButton() {
  const open = () => {
    window.dispatchEvent(new CustomEvent("apollo:movie-night"));
  };

  return (
    <button
      onClick={open}
      className="glass rounded-full px-5 py-2.5 text-sm font-semibold text-text-vivid transition hover:bg-white/10"
    >
      Create Movie Night Room
    </button>
  );
}
