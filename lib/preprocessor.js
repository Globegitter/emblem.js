var Emblem, Preprocessor, StringScanner;

StringScanner = require('StringScanner');

Emblem = require('./emblem');

Emblem.Preprocessor = Preprocessor = (function() {
  var DEDENT, INDENT, TERM, UNMATCHED_DEDENT, anyWhitespaceAndNewlinesTouchingEOF, any_whitespaceFollowedByNewlines_, processInput, ws;

  ws = '\\t\\x0B\\f \\xA0\\u1680\\u180E\\u2000-\\u200A\\u202F\\u205F\\u3000\\uFEFF';

  INDENT = '\uEFEF';

  DEDENT = '\uEFFE';

  UNMATCHED_DEDENT = '\uEFEE';

  TERM = '\uEFFF';

  anyWhitespaceAndNewlinesTouchingEOF = RegExp("[" + ws + "\\n]*$");

  any_whitespaceFollowedByNewlines_ = RegExp("(?:[" + ws + "]*\\n)+");

  function Preprocessor() {
    this.base = null;
    this.indents = [];
    this.context = [];
    this.context.peek = function() {
      if (this.length) {
        return this[this.length - 1];
      } else {
        return null;
      }
    };
    this.context.err = function(c) {
      throw new Error("Unexpected " + c);
    };
    this.output = '';
    this.context.observe = function(c) {
      var top;
      top = this.peek();
      switch (c) {
        case INDENT:
          this.push(c);
          break;
        case DEDENT:
          if (top !== INDENT) {
            this.err(c);
          }
          this.pop();
          break;
        case '\n':
          if (top !== '/') {
            this.err(c);
          }
          this.pop();
          break;
        case '/':
          this.push(c);
          break;
        case 'end-\\':
          if (top !== '\\') {
            this.err(c);
          }
          this.pop();
          break;
        default:
          throw new Error("undefined token observed: " + c);
      }
      return this;
    };
    if (this.StringScanner) {
      this.ss = new this.StringScanner('');
    } else if (Emblem.StringScanner) {
      this.ss = new Emblem.StringScanner('');
    } else {
      this.ss = new StringScanner('');
    }
  }

  Preprocessor.prototype.p = function(s) {
    if (s) {
      this.output += s;
    }
    return s;
  };

  Preprocessor.prototype.scan = function(r) {
    return this.p(this.ss.scan(r));
  };

  Preprocessor.prototype.discard = function(r) {
    return this.ss.scan(r);
  };

  processInput = function(isEnd) {
    return function(data) {
      var b, d, indent, s;
      if (!isEnd) {
        this.ss.concat(data);
        this.discard(any_whitespaceFollowedByNewlines_);
      }
      while (!this.ss.eos()) {
        switch (this.context.peek()) {
          case null:
          case INDENT:
            if (this.ss.bol() || this.discard(any_whitespaceFollowedByNewlines_)) {
              if (this.discard(RegExp("[" + ws + "]*\\n"))) {
                this.p("" + TERM + "\n");
                continue;
              }
              if (this.base != null) {
                if ((this.discard(this.base)) == null) {
                  throw new Error("inconsistent base indentation");
                }
              } else {
                b = this.discard(RegExp("[" + ws + "]*"));
                this.base = RegExp("" + b);
              }
              if (this.indents.length === 0) {
                if (this.ss.check(RegExp("[" + ws + "]+"))) {
                  this.p(INDENT);
                  this.context.observe(INDENT);
                  this.indents.push(this.scan(RegExp("([" + ws + "]+)")));
                }
              } else {
                indent = this.indents[this.indents.length - 1];
                if (d = this.ss.check(RegExp("(" + indent + ")"))) {
                  this.discard(d);
                  if (this.ss.check(RegExp("([" + ws + "]+)"))) {
                    this.p(INDENT);
                    this.context.observe(INDENT);
                    this.indents.push(d + this.scan(RegExp("([" + ws + "]+)")));
                  }
                } else {
                  while (this.indents.length) {
                    indent = this.indents[this.indents.length - 1];
                    if (this.discard(RegExp("(?:" + indent + ")"))) {
                      break;
                    }
                    this.context.observe(DEDENT);
                    this.p(DEDENT);
                    this.indents.pop();
                  }
                  if (s = this.discard(RegExp("[" + ws + "]+"))) {
                    this.output = this.output.slice(0, -1);
                    this.output += UNMATCHED_DEDENT;
                    this.p(INDENT);
                    this.context.observe(INDENT);
                    this.indents.push(s);
                  }
                }
              }
            }
            this.scan(/[^\n]+/);
            if (this.discard(/\n/)) {
              this.p("" + TERM + "\n");
            }
        }
      }
      if (isEnd) {
        this.scan(anyWhitespaceAndNewlinesTouchingEOF);
        while (this.context.length && INDENT === this.context.peek()) {
          this.context.observe(DEDENT);
          this.p(DEDENT);
        }
        if (this.context.length) {
          throw new Error('Unclosed ' + (this.context.peek()) + ' at EOF');
        }
      }
    };
  };

  Preprocessor.prototype.processData = processInput(false);

  Preprocessor.prototype.processEnd = processInput(true);

  Preprocessor.processSync = function(input) {
    var pre;
    input += "\n";
    pre = new Preprocessor;
    pre.processData(input);
    pre.processEnd();
    return pre.output;
  };

  return Preprocessor;

})();
