{pkgs}: {
  deps = [
    pkgs.xsimd
    pkgs.pkg-config
    pkgs.libxcrypt
    pkgs.portaudio
    pkgs.ffmpeg-full
    pkgs.glibcLocales
    pkgs.postgresql
  ];
}
