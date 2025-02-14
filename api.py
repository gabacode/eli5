import asyncio
import base64
import io
import json
import threading
from pathlib import Path
from queue import Empty
from typing import Dict, List

import pdfplumber
import websockets

from libs.nlp.text_processor import SectionInfo
from libs.utils.logger import Logger
from main import Application, Config

logger = Logger()


class TTSTransmitter:
    """Handles the transmission of TTS data over WebSocket."""

    def __init__(self, websocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.shutdown_flag = threading.Event()
        self.app = None

    def start_tts_app(self):
        """Initialize and start the TTS application."""
        config = Config(
            audio_dir=Path(f"audio_cache_{self.session_id}"),
            thread_timeout=10
        )
        self.app = Application(config)
        self.app.create_rec_thread()

    async def transmit_audio(self, audio_text_pair):
        """Transmit a single audio-text pair over WebSocket."""
        try:
            await self.websocket.send(json.dumps({
                'type': 'text',
                'content': audio_text_pair.text
            }))
            with open(audio_text_pair.audio_path, 'rb') as f:
                audio_data = f.read()
                await self.websocket.send(json.dumps({
                    'type': 'audio',
                    'content': base64.b64encode(audio_data).decode('utf-8')
                }))
            self.app.file_manager.cleanup_file(audio_text_pair.audio_path)

        except Exception as e:
            logger.error(f"Error transmitting audio: {e}")

    def monitor_queue(self, event_loop):
        """Monitor the playback queue and schedule transmissions."""
        while not self.shutdown_flag.is_set():
            try:
                audio_text_pair = self.app.playback_queue.get(timeout=0.5)
                if audio_text_pair and audio_text_pair.audio_path.exists():
                    asyncio.run_coroutine_threadsafe(
                        self.transmit_audio(audio_text_pair),
                        event_loop
                    )

            except Empty:
                continue
            except Exception as e:
                logger.error(f"Error in queue monitoring: {e}")
                continue

    def process_text(self, content: str):
        """Process the text content."""
        try:
            sections_info: List[SectionInfo] = self.app.text_processor.split_into_sections(content, 250, 50)
            logger.info(f"Found {len(sections_info)} sections")

            for i, section_info in enumerate(sections_info, 1):
                section_text = section_info.section
                subjects = section_info.subjects

                logger.info(f"Processing section {i}/{len(sections_info)}")
                logger.info(f"Subjects: {subjects}")

                if self.shutdown_flag.is_set():
                    break

                last_section = self.app.text_processor.destop_words(sections_info[i - 2].section) if i > 1 else ""
                self.app.process_section(last_section, section_text)

            # Empty memory here
            self.app.empty_cache()

        except Exception as e:
            logger.error(f"Error processing text: {e}")

    def shutdown(self):
        """Shutdown the transmitter and cleanup resources."""
        self.shutdown_flag.set()
        if self.app:
            self.app.shutdown()


class TTSServer:
    """WebSocket server for TTS service."""

    def __init__(self, host="localhost", port=8765):
        self.host = host
        self.port = port
        self.transmitters: Dict[str, TTSTransmitter] = {}
        self.chunks = {}

    async def handle_upload(self, websocket, content: bytes, session_id: str):
        """Handle file upload and start processing."""
        try:
            if content.startswith(b'%PDF'):
                with io.BytesIO(content) as pdf_file:
                    with pdfplumber.open(pdf_file) as pdf:
                        text = ""
                        for page in pdf.pages:
                            text += page.extract_text() or ""
                if not text:
                    raise Exception("No text extracted from PDF")
                await self.process_text(text, websocket, session_id)
            else:
                text_content = content.decode("utf-8", errors="ignore")
                await self.process_text(text_content, websocket, session_id)
        except Exception as e:
            logger.error(f"Error handling upload: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'content': str(e)
            }))

    async def process_text(self, content: str, websocket, session_id: str):
        """Transmit the text content over WebSocket."""
        try:
            logger.info(f"Processing text for session: {session_id}")
            logger.debug(content)
            transmitter = TTSTransmitter(websocket, session_id)
            self.transmitters[session_id] = transmitter

            # Start TTS application
            transmitter.start_tts_app()

            # Start queue monitoring in a separate thread
            monitor_thread = threading.Thread(
                target=transmitter.monitor_queue,
                args=(asyncio.get_event_loop(),),
                daemon=True,
                name=f"QueueMonitor-{session_id}"
            )
            monitor_thread.start()

            # Process the text in a separate thread
            process_thread = threading.Thread(
                target=transmitter.process_text,
                args=(content,),
                daemon=True,
                name=f"TextProcessor-{session_id}"
            )
            process_thread.start()

        except Exception as e:
            logger.error(f"Error processing text: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'content': str(e)
            }))

    async def cleanup_session(self, session_id: str):
        """Cleanup session resources."""
        if session_id in self.transmitters:
            transmitter = self.transmitters[session_id]
            transmitter.shutdown()
            del self.transmitters[session_id]

            # Cleanup cache directory
            cache_dir = Path(f"audio_cache_{session_id}")
            if cache_dir.exists():
                for file in cache_dir.glob("*"):
                    file.unlink()
                cache_dir.rmdir()

    async def handle_connection(self, websocket):
        """Handle incoming WebSocket upload requests."""
        session_id = str(hash(websocket))
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    if data.get('type') == 'chunk':
                        await self.handle_chunk(websocket, data, session_id)
                except json.JSONDecodeError:
                    logger.error("Invalid JSON received")
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {session_id}")

    async def handle_chunk(self, websocket, data, session_id: str):
        """Handle incoming file chunk."""
        try:
            file_id = f"{session_id}_{data['filename']}"
            if file_id not in self.chunks:
                self.chunks[file_id] = {
                    'chunks': [None] * data['totalChunks'],
                    'content_type': data['contentType']
                }
            chunk_data = bytes(data['content'])
            self.chunks[file_id]['chunks'][data['chunkIndex']] = chunk_data
            if all(chunk is not None for chunk in self.chunks[file_id]['chunks']):
                complete_content = b''.join(self.chunks[file_id]['chunks'])
                await self.handle_upload(websocket, complete_content, session_id)
                del self.chunks[file_id]

        except Exception as e:
            logger.error(f"Error handling chunk: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'content': str(e)
            }))

    async def start(self):
        """Start the WebSocket server."""
        async with websockets.serve(self.handle_connection, self.host, self.port):
            logger.info(f"TTS Server running at ws://{self.host}:{self.port}")
            await asyncio.Future()  # run forever


if __name__ == "__main__":
    server = TTSServer()
    asyncio.run(server.start())
