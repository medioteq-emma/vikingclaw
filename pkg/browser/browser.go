package browser

import (
	"context"
	"encoding/base64"
	"fmt"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/rs/zerolog/log"
)

// Browser wraps a chromedp headless browser session.
type Browser struct {
	ctx            context.Context
	cancel         context.CancelFunc
	mu             sync.Mutex
	active         bool
	lastScreenshot []byte
	currentURL     string
	navHistory     []string
}

// New creates a new Browser (not yet started).
func New() *Browser {
	return &Browser{}
}

// Start launches the headless Chrome instance.
func (b *Browser) Start() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.active {
		return nil
	}
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.WindowSize(1280, 800),
		chromedp.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
	)
	allocCtx, _ := chromedp.NewExecAllocator(context.Background(), opts...)
	ctx, cancel := chromedp.NewContext(allocCtx, chromedp.WithLogf(func(s string, i ...interface{}) {}))
	b.ctx = ctx
	b.cancel = cancel
	b.active = true
	log.Info().Msg("🌐 Browser started")
	return nil
}

// Stop shuts down the Chrome instance.
func (b *Browser) Stop() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.cancel != nil {
		b.cancel()
		b.active = false
	}
}

// Navigate loads a URL in the browser.
func (b *Browser) Navigate(url string) error {
	if !b.active {
		if err := b.Start(); err != nil {
			return err
		}
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	ctx, cancel := context.WithTimeout(b.ctx, 30*time.Second)
	defer cancel()

	err := chromedp.Run(ctx, chromedp.Navigate(url))
	if err != nil {
		return fmt.Errorf("navigate to %s: %w", url, err)
	}
	b.currentURL = url
	b.navHistory = append(b.navHistory, url)
	if len(b.navHistory) > 20 {
		b.navHistory = b.navHistory[len(b.navHistory)-20:]
	}
	return nil
}

// TakeScreenshot captures the current page as a base64 PNG.
func (b *Browser) TakeScreenshot() (string, error) {
	if !b.active {
		return "", fmt.Errorf("browser not started")
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	ctx, cancel := context.WithTimeout(b.ctx, 10*time.Second)
	defer cancel()

	var buf []byte
	err := chromedp.Run(ctx, chromedp.CaptureScreenshot(&buf))
	if err != nil {
		return "", err
	}
	b.lastScreenshot = buf
	return base64.StdEncoding.EncodeToString(buf), nil
}

// ExecuteJS runs JavaScript in the browser and returns the result as a string.
func (b *Browser) ExecuteJS(script string) (string, error) {
	if !b.active {
		return "", fmt.Errorf("browser not started")
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	ctx, cancel := context.WithTimeout(b.ctx, 15*time.Second)
	defer cancel()

	var result interface{}
	err := chromedp.Run(ctx, chromedp.Evaluate(script, &result))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%v", result), nil
}

// GetText returns the visible text content of the current page.
func (b *Browser) GetText() (string, error) {
	return b.ExecuteJS("document.body.innerText")
}

// Click clicks the first element matching a CSS selector.
func (b *Browser) Click(selector string) error {
	if !b.active {
		return fmt.Errorf("browser not started")
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	ctx, cancel := context.WithTimeout(b.ctx, 10*time.Second)
	defer cancel()

	return chromedp.Run(ctx, chromedp.Click(selector, chromedp.ByQuery))
}

// Type types text into a form field matching a CSS selector.
func (b *Browser) Type(selector, text string) error {
	if !b.active {
		return fmt.Errorf("browser not started")
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	ctx, cancel := context.WithTimeout(b.ctx, 10*time.Second)
	defer cancel()

	return chromedp.Run(ctx,
		chromedp.Click(selector, chromedp.ByQuery),
		chromedp.SendKeys(selector, text, chromedp.ByQuery),
	)
}

// BrowserStatus represents the current state of the browser.
type BrowserStatus struct {
	Active        bool     `json:"active"`
	CurrentURL    string   `json:"current_url"`
	HasScreenshot bool     `json:"has_screenshot"`
	NavHistory    []string `json:"nav_history"`
}

// Status returns the current browser status.
func (b *Browser) Status() BrowserStatus {
	b.mu.Lock()
	defer b.mu.Unlock()
	hist := make([]string, len(b.navHistory))
	copy(hist, b.navHistory)
	return BrowserStatus{
		Active:        b.active,
		CurrentURL:    b.currentURL,
		HasScreenshot: len(b.lastScreenshot) > 0,
		NavHistory:    hist,
	}
}
