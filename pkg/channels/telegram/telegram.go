package telegram

import (
	"context"
	"fmt"
	"strings"

	"github.com/medioteq/vikingclaw/pkg/agent"
	"github.com/medioteq/vikingclaw/pkg/config"
	tele "github.com/mymmrac/telego"
	th "github.com/mymmrac/telego/telegohandler"
	tu "github.com/mymmrac/telego/telegoutil"
	"github.com/rs/zerolog/log"
)

const maxTelegramMsg = 4096

// Bot wraps a Telegram bot and routes messages to the agent loop.
type Bot struct {
	bot      *tele.Bot
	loop     *agent.AgentLoop
	cfg      config.TelegramConfig
	allowSet map[int64]struct{}
}

// New creates a Telegram Bot.
func New(cfg config.TelegramConfig, loop *agent.AgentLoop) (*Bot, error) {
	bot, err := tele.NewBot(cfg.BotToken, tele.WithDefaultDebugLogger())
	if err != nil {
		return nil, fmt.Errorf("telego init: %w", err)
	}

	allowSet := make(map[int64]struct{}, len(cfg.AllowedUsers))
	for _, id := range cfg.AllowedUsers {
		allowSet[id] = struct{}{}
	}

	return &Bot{
		bot:      bot,
		loop:     loop,
		cfg:      cfg,
		allowSet: allowSet,
	}, nil
}

func (b *Bot) Name() string { return "telegram" }

// Start begins long-polling for updates.
func (b *Bot) Start(ctx context.Context) error {
	updates, err := b.bot.UpdatesViaLongPolling(nil, tele.WithLongPollingContext(ctx))
	if err != nil {
		return fmt.Errorf("long polling: %w", err)
	}

	bh, err := th.NewBotHandler(b.bot, updates)
	if err != nil {
		return fmt.Errorf("bot handler: %w", err)
	}

	// /start command
	bh.Handle(b.handleStart, th.CommandEqual("start"))

	// /memory command
	bh.Handle(b.handleMemory, th.CommandEqual("memory"))

	// All text messages
	bh.Handle(b.handleMessage, th.AnyMessage())

	bh.Start()
	return nil
}

// Stop shuts down the bot.
func (b *Bot) Stop() error {
	b.bot.StopLongPolling()
	return nil
}

// isAllowed returns true if the user is in the allowed list (or list is empty).
func (b *Bot) isAllowed(userID int64) bool {
	if len(b.allowSet) == 0 {
		return true
	}
	_, ok := b.allowSet[userID]
	return ok
}

func (b *Bot) handleStart(bot *tele.Bot, update tele.Update) {
	if update.Message == nil {
		return
	}
	if !b.isAllowed(update.Message.From.ID) {
		b.sendText(update.Message.Chat.ChatID(), "⛔ Unauthorized.")
		return
	}
	welcome := "⚔️ *VikingClaw* is ready.\n\nSend me a message and I'll get to work.\n\n/memory — show memory summary"
	b.sendText(update.Message.Chat.ChatID(), welcome)
}

func (b *Bot) handleMemory(bot *tele.Bot, update tele.Update) {
	if update.Message == nil {
		return
	}
	if !b.isAllowed(update.Message.From.ID) {
		b.sendText(update.Message.Chat.ChatID(), "⛔ Unauthorized.")
		return
	}
	// Ask the agent for a memory summary
	ctx := context.Background()
	summary, err := b.loop.Process(ctx, "Give me a brief summary of your memory and what you know about me so far.", fmt.Sprintf("tg_%d", update.Message.From.ID))
	if err != nil {
		b.sendText(update.Message.Chat.ChatID(), fmt.Sprintf("⚠️ Error: %s", err))
		return
	}
	b.sendText(update.Message.Chat.ChatID(), summary)
}

func (b *Bot) handleMessage(bot *tele.Bot, update tele.Update) {
	if update.Message == nil || update.Message.Text == "" {
		return
	}

	msg := update.Message
	chatID := msg.Chat.ChatID()
	userID := msg.From.ID

	if !b.isAllowed(userID) {
		log.Warn().Int64("user_id", userID).Msg("telegram: rejected unauthorized user")
		b.sendText(chatID, "⛔ You are not authorized to use this agent.")
		return
	}

	// Skip commands (handled separately)
	if strings.HasPrefix(msg.Text, "/") {
		return
	}

	log.Info().
		Int64("user", userID).
		Str("text", msg.Text).
		Msg("telegram message")

	// Send typing indicator
	_ = bot.SendChatAction(&tele.SendChatActionParams{
		ChatID: chatID,
		Action: tele.ChatActionTyping,
	})

	sessionID := fmt.Sprintf("tg_%d", userID)
	ctx := context.Background()

	response, err := b.loop.Process(ctx, msg.Text, sessionID)
	if err != nil {
		log.Error().Err(err).Msg("agent error")
		b.sendText(chatID, fmt.Sprintf("⚠️ Error: %s", err))
		return
	}

	// Split and send (Telegram has a 4096-char limit)
	chunks := agent.SplitMessage(response, maxTelegramMsg)
	for _, chunk := range chunks {
		b.sendText(chatID, chunk)
	}
}

func (b *Bot) sendText(chatID tele.ChatID, text string) {
	_, err := b.bot.SendMessage(tu.Message(chatID, text))
	if err != nil {
		log.Error().Err(err).Msg("telegram send failed")
	}
}
