package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// handleInstallSh serves the install.sh script.
func (s *Server) handleInstallSh(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	http.ServeFile(w, r, "./landing/install.sh")
}

// handleInstallPs1 serves the install.ps1 script.
func (s *Server) handleInstallPs1(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	http.ServeFile(w, r, "./landing/install.ps1")
}

// handleGoogleStatus checks if gws credentials and token are present.
func (s *Server) handleGoogleStatus(w http.ResponseWriter, r *http.Request) {
	home, _ := os.UserHomeDir()
	tokenPath := filepath.Join(home, ".config", "gws", "token.json")
	secretPath := filepath.Join(home, ".config", "gws", "client_secret.json")

	hasSecret := fileExists(secretPath)
	hasToken := fileExists(tokenPath)

	jsonResponse(w, map[string]interface{}{
		"connected":       hasToken,
		"has_credentials": hasSecret,
		"setup_url":       "https://console.cloud.google.com",
		"token_path":      tokenPath,
		"secret_path":     secretPath,
	})
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// handleGoogleGmail lists unread Gmail messages via gws CLI.
func (s *Server) handleGoogleGmail(w http.ResponseWriter, r *http.Request) {
	out, err := exec.Command("gws", "gmail", "users", "messages", "list",
		"--params", `{"userId":"me","maxResults":10,"q":"is:unread"}`,
		"--format", "json").Output()
	if err != nil {
		jsonResponse(w, map[string]interface{}{
			"error":    "Not connected. Run: gws auth login -s gmail",
			"messages": []interface{}{},
		})
		return
	}
	var data interface{}
	json.Unmarshal(out, &data) //nolint:errcheck
	jsonResponse(w, data)
}

// handleGoogleCalendar lists today's calendar events via gws CLI.
func (s *Server) handleGoogleCalendar(w http.ResponseWriter, r *http.Request) {
	now := time.Now().UTC().Format(time.RFC3339)
	params := fmt.Sprintf(`{"calendarId":"primary","timeMin":"%s","maxResults":10,"singleEvents":true,"orderBy":"startTime"}`, now)
	out, err := exec.Command("gws", "calendar", "events", "list",
		"--params", params, "--format", "json").Output()
	if err != nil {
		jsonResponse(w, map[string]interface{}{
			"error": "Not connected. Run: gws auth login -s calendar",
			"items": []interface{}{},
		})
		return
	}
	var data interface{}
	json.Unmarshal(out, &data) //nolint:errcheck
	jsonResponse(w, data)
}

// handleGoogleDrive lists recent Drive files via gws CLI.
func (s *Server) handleGoogleDrive(w http.ResponseWriter, r *http.Request) {
	out, err := exec.Command("gws", "drive", "files", "list",
		"--params", `{"pageSize":10,"orderBy":"modifiedTime desc","fields":"files(id,name,mimeType,modifiedTime,size)"}`,
		"--format", "json").Output()
	if err != nil {
		jsonResponse(w, map[string]interface{}{
			"error": "Not connected. Run: gws auth login -s drive",
			"files": []interface{}{},
		})
		return
	}
	var data interface{}
	json.Unmarshal(out, &data) //nolint:errcheck
	jsonResponse(w, data)
}
