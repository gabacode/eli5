from dataclasses import dataclass
from pathlib import Path


@dataclass
class Config:
    thread_timeout: int = 10
    audio_dir: Path = Path("audio_cache")
    ollama_host: str = "http://localhost:11434"
    ollama_llm: str = "gemma2:latest"
    max_queue_size: int = 1000
    audio_sample_rate: int = 44100
    model_name: str = "tts_models/multilingual/multi-dataset/xtts_v2"
    voice_file: str = "voice.wav"


@dataclass
class AudioTextPair:
    text: str
    audio_path: Path
