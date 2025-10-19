import { Terminal } from 'xterm';
import { executeCommand } from '@/lib/commands';

export class CommandParser {
  private term: Terminal;
  private currentLine: string = '';
  private cursorPosition: number = 0;
  private historyIndex: number = -1;
  private commandHistory: string[] = [];
  private addToHistory: (command: string) => void;

  constructor(term: Terminal, addToHistory: (command: string) => void) {
    this.term = term;
    this.addToHistory = addToHistory;

    // Load history from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pablos-command-history');
      if (saved) {
        this.commandHistory = JSON.parse(saved);
      }
    }

    this.setupHandlers();
  }

  private setupHandlers() {
    this.term.onData((data) => {
      const code = data.charCodeAt(0);

      // Handle special keys
      if (code === 13) {
        // Enter
        this.handleEnter();
      } else if (code === 127) {
        // Backspace
        this.handleBackspace();
      } else if (code === 27) {
        // Escape sequences (arrow keys, etc.)
        if (data === '\x1b[A') {
          // Up arrow
          this.handleUpArrow();
        } else if (data === '\x1b[B') {
          // Down arrow
          this.handleDownArrow();
        } else if (data === '\x1b[C') {
          // Right arrow
          this.handleRightArrow();
        } else if (data === '\x1b[D') {
          // Left arrow
          this.handleLeftArrow();
        } else if (data === '\x1b[3~') {
          // Delete
          this.handleDelete();
        }
      } else if (code === 3) {
        // Ctrl+C
        this.handleCtrlC();
      } else if (code === 12) {
        // Ctrl+L (clear)
        this.handleClear();
      } else if (code >= 32 && code <= 126) {
        // Printable characters
        this.handleChar(data);
      }
    });
  }

  private handleEnter() {
    this.term.write('\r\n');
    const command = this.currentLine.trim();

    if (command) {
      // Add to history
      this.commandHistory.push(command);
      this.addToHistory(command);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('pablos-command-history', JSON.stringify(this.commandHistory.slice(-100)));
      }

      // Execute command
      this.executeCommand(command);
    } else {
      this.prompt();
    }

    this.currentLine = '';
    this.cursorPosition = 0;
    this.historyIndex = -1;
  }

  private handleBackspace() {
    if (this.cursorPosition > 0) {
      this.currentLine =
        this.currentLine.slice(0, this.cursorPosition - 1) +
        this.currentLine.slice(this.cursorPosition);
      this.cursorPosition--;
      this.redrawLine();
    }
  }

  private handleDelete() {
    if (this.cursorPosition < this.currentLine.length) {
      this.currentLine =
        this.currentLine.slice(0, this.cursorPosition) +
        this.currentLine.slice(this.cursorPosition + 1);
      this.redrawLine();
    }
  }

  private handleChar(char: string) {
    this.currentLine =
      this.currentLine.slice(0, this.cursorPosition) +
      char +
      this.currentLine.slice(this.cursorPosition);
    this.cursorPosition++;
    this.redrawLine();
  }

  private handleUpArrow() {
    if (this.commandHistory.length === 0) return;

    if (this.historyIndex === -1) {
      this.historyIndex = this.commandHistory.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex--;
    }

    this.currentLine = this.commandHistory[this.historyIndex];
    this.cursorPosition = this.currentLine.length;
    this.redrawLine();
  }

  private handleDownArrow() {
    if (this.historyIndex === -1) return;

    if (this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      this.currentLine = this.commandHistory[this.historyIndex];
    } else {
      this.historyIndex = -1;
      this.currentLine = '';
    }

    this.cursorPosition = this.currentLine.length;
    this.redrawLine();
  }

  private handleLeftArrow() {
    if (this.cursorPosition > 0) {
      this.cursorPosition--;
      this.term.write('\x1b[D');
    }
  }

  private handleRightArrow() {
    if (this.cursorPosition < this.currentLine.length) {
      this.cursorPosition++;
      this.term.write('\x1b[C');
    }
  }

  private handleCtrlC() {
    this.term.write('^C\r\n');
    this.currentLine = '';
    this.cursorPosition = 0;
    this.historyIndex = -1;
    this.prompt();
  }

  private handleClear() {
    this.term.clear();
    this.prompt();
  }

  private redrawLine() {
    // Clear current line
    this.term.write('\r\x1b[K');
    
    // Redraw prompt and line
    this.term.write('\x1b[1;32mpablos>\x1b[0m ' + this.currentLine);
    
    // Move cursor to correct position
    const offset = this.currentLine.length - this.cursorPosition;
    if (offset > 0) {
      this.term.write(`\x1b[${offset}D`);
    }
  }

  public prompt() {
    this.term.write('\x1b[1;32mpablos>\x1b[0m ');
  }

  private async executeCommand(command: string) {
    try {
      await executeCommand(command, this.term);
    } catch (error: any) {
      this.term.writeln(`\x1b[1;31mError:\x1b[0m ${error.message}`);
    }
    
    this.prompt();
  }

  public writeln(text: string) {
    this.term.writeln(text);
  }

  public write(text: string) {
    this.term.write(text);
  }
}

