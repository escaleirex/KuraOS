package ops

import (
	"errors"
	"fmt"
	"regexp"

	"github.com/kura-os/kura/backend/pkg/ipc"
	"github.com/msteinert/pam/v2"
)

// reUsername allows only safe characters — never pass raw user input to PAM.
var reUsername = regexp.MustCompile(`^[a-zA-Z0-9_\-\.]{1,64}$`)

// PAMVerify authenticates a local system user via PAM.
// Required params: username, password
// Password is never logged.
func PAMVerify(params map[string]string) ipc.Reply {
	username := params["username"]
	password := params["password"]

	if !reUsername.MatchString(username) {
		return ipc.Reply{OK: false, Error: "invalid username"}
	}
	if password == "" {
		return ipc.Reply{OK: false, Error: "empty password"}
	}

	t, err := pam.StartFunc("login", username, func(s pam.Style, _ string) (string, error) {
		switch s {
		case pam.PromptEchoOff, pam.PromptEchoOn:
			return password, nil
		case pam.ErrorMsg, pam.TextInfo:
			return "", nil
		}
		return "", errors.New("unhandled PAM style")
	})
	if err != nil {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("pam start: %v", err)}
	}

	if err := t.Authenticate(0); err != nil {
		return ipc.Reply{OK: false, Error: "authentication failed"}
	}

	return ipc.Reply{OK: true}
}
