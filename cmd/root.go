package cmd

import (
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "vikingclaw",
	Short: "⚔️ VikingClaw — Local-first AI agent",
	Long:  `VikingClaw is a local-first AI agent framework. Zero cloud by default. Runs on any hardware.`,
}

// Execute runs the root command.
func Execute() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(startCmd)
	rootCmd.AddCommand(onboardCmd)
}
