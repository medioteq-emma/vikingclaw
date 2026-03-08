package bus

import (
	"sync"
	"time"
)

// Handler is a function that receives an Event.
type Handler func(event Event)

// Bus is a simple in-process publish/subscribe event bus.
type Bus struct {
	mu          sync.RWMutex
	subscribers map[EventType][]Handler
}

// New creates a new Bus.
func New() *Bus {
	return &Bus{
		subscribers: make(map[EventType][]Handler),
	}
}

// Subscribe registers a handler for a specific event type.
// Use "*" as EventType to receive all events.
func (b *Bus) Subscribe(eventType EventType, handler Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subscribers[eventType] = append(b.subscribers[eventType], handler)
}

// Publish sends an event to all matching subscribers.
// Subscribers are called synchronously in registration order.
func (b *Bus) Publish(event Event) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	// Dispatch to specific-type subscribers
	for _, h := range b.subscribers[event.Type] {
		h(event)
	}

	// Dispatch to wildcard subscribers
	if event.Type != "*" {
		for _, h := range b.subscribers["*"] {
			h(event)
		}
	}
}

// PublishAsync sends an event asynchronously (non-blocking).
func (b *Bus) PublishAsync(event Event) {
	go b.Publish(event)
}

// Unsubscribe removes all handlers for an event type.
func (b *Bus) Unsubscribe(eventType EventType) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.subscribers, eventType)
}

// SubscriberCount returns the number of handlers for an event type.
func (b *Bus) SubscriberCount(eventType EventType) int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subscribers[eventType])
}
