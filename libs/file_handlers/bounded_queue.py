import logging
from queue import Queue, Full, Empty


class BoundedQueue:
    """Thread-safe bounded queue implementation."""

    def __init__(self, maxsize: int = 1000):
        self.queue = Queue(maxsize=maxsize)

    def put(self, item, timeout: float = 1) -> bool:
        try:
            self.queue.put(item, timeout=timeout)
            logging.debug(f"Item enqueued: {item}")
            return True
        except Full:
            logging.warning("Queue is full, dropping item")
            return False

    def get(self, timeout: float = 1):
        try:
            item = self.queue.get(timeout=timeout)
            logging.debug(f"Item dequeued: {item}")
            return item
        except Empty:
            return None

    def empty(self) -> bool:
        return self.queue.empty()
