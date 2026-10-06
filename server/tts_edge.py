"""Decode Edge TTS MP3 into the HUD's 16 kHz mono signed PCM format."""

from __future__ import annotations

import asyncio
from io import BytesIO

import edge_tts
import imageio_ffmpeg
from pydub import AudioSegment


def _decode_mp3(mp3: bytes) -> bytes:
    # pydub needs an ffmpeg binary on Windows; imageio_ffmpeg provides one.
    AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()
    # The explicit codec avoids pydub's separate ffprobe lookup on Windows.
    segment = AudioSegment.from_file(BytesIO(mp3), format="mp3", codec="mp3")
    pcm = segment.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    if not pcm.raw_data:
        raise RuntimeError("Edge TTS audio decoded to empty PCM")
    return pcm.raw_data


async def _stream_mp3(text: str, voice: str) -> bytes:
    mp3 = bytearray()
    async for chunk in edge_tts.Communicate(text, voice).stream():
        if chunk["type"] == "audio":
            mp3.extend(chunk["data"])
    if not mp3:
        raise RuntimeError("Edge TTS returned no audio")
    return bytes(mp3)


async def text_to_pcm(
    text: str,
    voice: str = "ar-JO-TaimNeural",
    fallback_voice: str = "ar-SA-ZariyahNeural",
) -> bytes:
    try:
        mp3 = await _stream_mp3(text, voice)
    except Exception:
        if not fallback_voice or fallback_voice == voice:
            raise
        mp3 = await _stream_mp3(text, fallback_voice)
    return await asyncio.to_thread(_decode_mp3, mp3)
