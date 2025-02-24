import logging
import threading
from dataclasses import dataclass
from queue import Queue, Full, Empty
from typing import Any


@dataclass
class TrackedItem:
    item: Any
    position: int
    total_items: int


class BoundedQueue:
    """Thread-safe bounded queue implementation with position tracking."""

    def __init__(self, maxsize: int = 1000):
        self.queue = Queue(maxsize=maxsize)
        self._total_enqueued = 0
        self._items_processed = 0
        self._lock = threading.Lock()

    def put(self, item, timeout: float = 1) -> bool:
        try:
            with self._lock:
                self._total_enqueued += 1
                tracked_item = TrackedItem(
                    item=item,
                    position=self._total_enqueued,
                    total_items=self._total_enqueued
                )

            self.queue.put(tracked_item, timeout=timeout)
            logging.debug(
                f"Item enqueued: {item} (#{self._total_enqueued}, "
                f"{self.queue.qsize()} items in queue)"
            )
            return True
        except Full:
            logging.warning("Queue is full, dropping item")
            return False

    def get(self, timeout: float = 1):
        try:
            tracked_item = self.queue.get(timeout=timeout)
            with self._lock:
                self._items_processed += 1
                remaining = self.queue.qsize()

            logging.info(
                f"Processing item #{tracked_item.position}/{remaining} "
                f"({remaining} items remaining)"
            )
            return tracked_item.item
        except Empty:
            return None

    def empty(self) -> bool:
        return self.queue.empty()

    def get_stats(self):
        return {
            'items_remaining': self.queue.qsize(),
            'total_enqueued': self._total_enqueued,
            'items_processed': self._items_processed,
            'position': f"{self._items_processed}/{self._total_enqueued}"
        }
