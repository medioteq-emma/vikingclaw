package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/medioteq/vikingclaw/pkg/agent"
	"github.com/medioteq/vikingclaw/pkg/api"
	tgchannel "github.com/medioteq/vikingclaw/pkg/channels/telegram"
	"github.com/medioteq/vikingclaw/pkg/config"
	"github.com/medioteq/vikingclaw/pkg/memory"
	"github.com/medioteq/vikingclaw/pkg/providers"
	"github.com/medioteq/vikingclaw/pkg/security"
	"github.com/medioteq/vikingclaw/pkg/tools"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the VikingClaw agent",
	RunE:  runStart,
}

func runStart(cmd *cobra.Command, args []string) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}

	log.Info().Str("agent", cfg.Agent.Name).Msg("⚔️ VikingClaw starting")

	// Init components
	mem := memory.NewStore(cfg.Workspace)
	policy := security.NewPolicy(cfg.Security)
	toolReg := tools.NewRegistry(policy, cfg.Workspace)
	router := providers.NewRouter(cfg.Providers)

	loop := agent.NewLoop(router, mem, toolReg, policy, &cfg.Agent)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start HQ API server + automation engine
	apiServer := api.NewServer("7070", cfg, loop, toolReg, router)
	apiServer.StartEngine(ctx)
	go func() {
		if err := apiServer.Start(ctx); err != nil && err != http.ErrServerClosed {
			log.Error().Err(err).Msg("API server error")
		}
	}()
	log.Info().Msg("✅ HQ API running on http://localhost:7070")

	// Start Telegram channel if configured
	if cfg.Channels.Telegram.BotToken != "" {
		tg, err := tgchannel.New(cfg.Channels.Telegram, loop)
		if err != nil {
			return fmt.Errorf("telegram: %w", err)
		}

		go func() {
			if err := tg.Start(ctx); err != nil {
				log.Error().Err(err).Msg("Telegram error")
			}
		}()
		log.Info().Msg("✅ Telegram connected")
	}

	// Wait for OS shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info().Msg("Shutting down...")
	return nil
}
