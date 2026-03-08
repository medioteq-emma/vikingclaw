package channels

import "context"

// Channel is the common interface for all messaging channels.
type Channel interface {
	// Name returns the channel identifier (e.g. "telegram").
	Name() string
	// Start begins receiving messages and blocks until ctx is cancelled.
	Start(ctx context.Context) error
	// Stop gracefully shuts down the channel.
	Stop() error
}
