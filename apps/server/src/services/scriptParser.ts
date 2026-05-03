// Battle DSL Parser - Recursive Descent Parser
// Custom sandboxed language for Robocode battles

export type ActionName = 'attack' | 'defend' | 'heal' | 'special' | 'charge'

export type ASTNode =
  | { type: 'Script'; body: ASTNode[] }
  | { type: 'Assignment'; varName: string; value: ExprNode }
  | { type: 'IfStatement'; condition: BoolExprNode; then: ASTNode[]; elseIf: {cond: BoolExprNode, body: ASTNode[]}[]; else: ASTNode[] | null }
  | { type: 'Action'; name: ActionName }

export type ExprNode =
  | { type: 'IntLiteral'; value: number }
  | { type: 'Identifier'; name: string }
  | { type: 'BinaryOp'; op: '+' | '-' | '*' | '/' | '%'; left: ExprNode; right: ExprNode }

export type BoolExprNode =
  | { type: 'BoolLiteral'; value: boolean }
  | { type: 'Identifier'; name: string }
  | { type: 'Comparison'; op: '<' | '>' | '<=' | '>=' | '==' | '!='; left: ExprNode; right: ExprNode }
  | { type: 'UnaryNot'; operand: BoolExprNode }
  | { type: 'BinaryBoolOp'; op: '&&' | '||'; left: BoolExprNode; right: BoolExprNode }

export const PREDECLARED_VARS = [
  'myHP', 'enemyHP', 'myShield', 'enemyShield', 
  'lastEnemyMove', 'tickNumber', 'myMana'
]

export const FORBIDDEN_PATTERNS = [
  /while\s*\(/,
  /for\s*\(/,
  /import\s/,
  /System\./,
  /new\s+/,
  /\bclass\b/,
  /\bvoid\b/,
  /\.length/,
  /\bthrow\b/,
  /\btry\b/,
  /\bcatch\b/,
]

interface Token {
  type: 'INT' | 'IDENT' | 'OP' | 'BOOL' | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE' | 'SEMI' | 'IF' | 'ELSE' | 'ELSE_IF' | 'INT_KW' | 'BOOLEAN_KW'
  value: string
  line: number
}

export interface ParseResult {
  ast: ASTNode | null
  errors: string[]
  warnings: string[]
}

export function parseScript(scriptBody: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Pre-parse security check
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(scriptBody)) {
      errors.push(`Forbidden pattern detected: ${pattern.source}`)
      return { ast: null, errors, warnings }
    }
  }

  // Check line count
  const lines = scriptBody.split('\n').filter(l => l.trim())
  if (lines.length > 15) {
    errors.push(`Script exceeds 15 line limit (has ${lines.length} lines)`)
    return { ast: null, errors, warnings }
  }

  // Tokenize
  const tokens = tokenize(scriptBody)
  if (tokens.length === 0) {
    errors.push('Empty script')
    return { ast: null, errors, warnings }
  }

  // Parse
  let pos = 0
  try {
    const ast = parseScriptNode(tokens, pos, errors, warnings)
    // Validate AST
    const validationErrors = validateAST(ast)
    if (validationErrors.length > 0) {
      return { ast: null, errors: validationErrors, warnings }
    }
    return { ast, errors, warnings }
  } catch (e: any) {
    errors.push(e.message || 'Parse error')
    return { ast: null, errors, warnings }
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  const lines = input.split('\n')
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    let i = 0
    
    while (i < line.length) {
      const ch = line[i]
      
      // Skip whitespace
      if (/\s/.test(ch)) { i++; continue }
      
      // Comments
      if (ch === '/' && line[i+1] === '/') break
      
      // Two-char operators
      if (ch === '=' && line[i+1] === '=') { tokens.push({ type: 'OP', value: '==', line: lineNum + 1 }); i += 2; continue }
      if (ch === '!' && line[i+1] === '=') { tokens.push({ type: 'OP', value: '!=', line: lineNum + 1 }); i += 2; continue }
      if (ch === '<' && line[i+1] === '=') { tokens.push({ type: 'OP', value: '<=', line: lineNum + 1 }); i += 2; continue }
      if (ch === '>' && line[i+1] === '=') { tokens.push({ type: 'OP', value: '>=', line: lineNum + 1 }); i += 2; continue }
      if (ch === '&' && line[i+1] === '&') { tokens.push({ type: 'OP', value: '&&', line: lineNum + 1 }); i += 2; continue }
      if (ch === '|' && line[i+1] === '|') { tokens.push({ type: 'OP', value: '||', line: lineNum + 1 }); i += 2; continue }
      
      // Single-char operators
      if ('+-*/%<>=(){};'.includes(ch)) {
        const type = ch === '(' ? 'LPAREN' : ch === ')' ? 'RPAREN' : ch === '{' ? 'LBRACE' : ch === '}' ? 'RBRACE' : ch === ';' ? 'SEMI' : 'OP'
        tokens.push({ type, value: ch, line: lineNum + 1 })
        i++
        continue
      }
      
      // Keywords and identifiers
      if (/[a-zA-Z_]/.test(ch)) {
        let word = ''
        while (i < line.length && /[a-zA-Z0-9_]/.test(line[i])) {
          word += line[i]
          i++
        }
        
        if (word === 'if') { tokens.push({ type: 'IF', value: word, line: lineNum + 1 }) }
        else if (word === 'else') {
          // Check if next token is 'if'
          const nextNonSpace = line.slice(i).trimStart()
          if (nextNonSpace.startsWith('if ')) {
            tokens.push({ type: 'ELSE_IF', value: 'else if', line: lineNum + 1 })
            // Skip 'if' 
            i += line.slice(i).indexOf('if') + 2
          } else {
            tokens.push({ type: 'ELSE', value: word, line: lineNum + 1 })
          }
        }
        else if (word === 'int') { tokens.push({ type: 'INT_KW', value: word, line: lineNum + 1 }) }
        else if (word === 'boolean') { tokens.push({ type: 'BOOLEAN_KW', value: word, line: lineNum + 1 }) }
        else if (word === 'true' || word === 'false') { tokens.push({ type: 'BOOL', value: word, line: lineNum + 1 }) }
        else { tokens.push({ type: 'IDENT', value: word, line: lineNum + 1 }) }
        continue
      }
      
      // Numbers
      if (/[0-9]/.test(ch)) {
        let num = ''
        while (i < line.length && /[0-9]/.test(line[i])) {
          num += line[i]
          i++
        }
        tokens.push({ type: 'INT', value: num, line: lineNum + 1 })
        continue
      }
      
      i++
    }
  }
  
  return tokens
}

function parseScriptNode(tokens: Token[], pos: number, errors: string[], warnings: string[]): ASTNode {
  const body: ASTNode[] = []
  let p = pos
  
  while (p < tokens.length) {
    const token = tokens[p]
    
    if (token.type === 'INT_KW' || token.type === 'BOOLEAN_KW') {
      body.push(parseAssignment(tokens, p, errors, warnings))
      // Advance past the assignment
      while (p < tokens.length && tokens[p].type !== 'SEMI') p++
      if (p < tokens.length && tokens[p].type === 'SEMI') p++
    } else if (token.type === 'IF') {
      body.push(parseIfStatement(tokens, p, errors, warnings))
    } else if (token.type === 'IDENT') {
      // Could be assignment or action
      if (p + 1 < tokens.length && tokens[p + 1].type === 'OP' && tokens[p + 1].value === '=') {
        body.push(parseAssignment(tokens, p, errors, warnings))
        while (p < tokens.length && tokens[p].type !== 'SEMI') p++
        if (p < tokens.length && tokens[p].type === 'SEMI') p++
      } else {
        body.push(parseAction(tokens, p))
        if (p < tokens.length && tokens[p].type === 'SEMI') p++
      }
    } else {
      errors.push(`Unexpected token at line ${token.line}: ${token.value}`)
      p++
    }
  }
  
  return { type: 'Script', body }
}

function parseAssignment(tokens: Token[], pos: number, errors: string[], warnings: string[]): ASTNode {
  const varType = tokens[pos].value // 'int' or 'boolean'
  const varName = tokens[pos + 1].value
  const value = parseExpr(tokens, pos + 3, errors, warnings)
  return { type: 'Assignment', varName, value }
}

function parseIfStatement(tokens: Token[], pos: number, errors: string[], warnings: string[]): ASTNode {
  // if ( condition ) { body }
  let p = pos + 1 // Skip 'if'
  // Skip '('
  while (p < tokens.length && tokens[p].type !== 'LPAREN') p++
  p++ // Skip '('
  
  const condition = parseBoolExpr(tokens, p, errors, warnings)
  
  // Skip to '{'
  while (p < tokens.length && tokens[p].type !== 'LBRACE') p++
  p++ // Skip '{'
  
  const thenBody: ASTNode[] = []
  while (p < tokens.length && tokens[p].type !== 'RBRACE') {
    if (tokens[p].type === 'IDENT' && ['attack', 'defend', 'heal', 'special', 'charge'].includes(tokens[p].value)) {
      thenBody.push(parseAction(tokens, p))
      if (p < tokens.length && tokens[p].type === 'SEMI') p++
    }
    p++
  }
  p++ // Skip '}'
  
  // Check for else if / else
  const elseIf: {cond: BoolExprNode, body: ASTNode[]}[] = []
  let elseBody: ASTNode[] | null = null
  
  while (p < tokens.length && tokens[p].type === 'ELSE_IF') {
    p++ // Skip 'else if'
    while (p < tokens.length && tokens[p].type !== 'LPAREN') p++
    p++
    const elifCond = parseBoolExpr(tokens, p, errors, warnings)
    while (p < tokens.length && tokens[p].type !== 'LBRACE') p++
    p++
    const elifBody: ASTNode[] = []
    while (p < tokens.length && tokens[p].type !== 'RBRACE') {
      if (tokens[p].type === 'IDENT' && ['attack', 'defend', 'heal', 'special', 'charge'].includes(tokens[p].value)) {
        elifBody.push(parseAction(tokens, p))
        if (p < tokens.length && tokens[p].type === 'SEMI') p++
      }
      p++
    }
    p++
    elseIf.push({ cond: elifCond, body: elifBody })
  }
  
  if (p < tokens.length && tokens[p].type === 'ELSE') {
    p++
    while (p < tokens.length && tokens[p].type !== 'LBRACE') p++
    p++
    elseBody = []
    while (p < tokens.length && tokens[p].type !== 'RBRACE') {
      if (tokens[p].type === 'IDENT' && ['attack', 'defend', 'heal', 'special', 'charge'].includes(tokens[p].value)) {
        elseBody.push(parseAction(tokens, p))
        if (p < tokens.length && tokens[p].type === 'SEMI') p++
      }
      p++
    }
  }
  
  return { type: 'IfStatement', condition, then: thenBody, elseIf, else: elseBody }
}

function parseAction(tokens: Token[], pos: number): ASTNode {
  const name = tokens[pos].value as ActionName
  return { type: 'Action', name }
}

function parseExpr(tokens: Token[], pos: number, errors: string[], warnings: string[]): ExprNode {
  let p = pos
  let left = parseTerm(tokens, p, errors, warnings)
  
  while (p < tokens.length && tokens[p].type === 'OP' && (tokens[p].value === '+' || tokens[p].value === '-')) {
    const op = tokens[p].value as '+' | '-'
    p++
    const right = parseTerm(tokens, p, errors, warnings)
    left = { type: 'BinaryOp', op, left, right }
  }
  
  return left
}

function parseTerm(tokens: Token[], pos: number, errors: string[], warnings: string[]): ExprNode {
  let p = pos
  let left = parseFactor(tokens, p, errors, warnings)
  
  while (p < tokens.length && tokens[p].type === 'OP' && (tokens[p].value === '*' || tokens[p].value === '/' || tokens[p].value === '%')) {
    const op = tokens[p].value as '*' | '/' | '%'
    p++
    const right = parseFactor(tokens, p, errors, warnings)
    left = { type: 'BinaryOp', op, left, right }
  }
  
  return left
}

function parseFactor(tokens: Token[], pos: number, errors: string[], warnings: string[]): ExprNode {
  if (tokens[pos].type === 'INT') {
    return { type: 'IntLiteral', value: parseInt(tokens[pos].value) }
  }
  if (tokens[pos].type === 'IDENT') {
    return { type: 'Identifier', name: tokens[pos].value }
  }
  if (tokens[pos].type === 'LPAREN') {
    const expr = parseExpr(tokens, pos + 1, errors, warnings)
    return expr
  }
  throw new Error(`Unexpected token in expression: ${tokens[pos].value}`)
}

function parseBoolExpr(tokens: Token[], pos: number, errors: string[], warnings: string[]): BoolExprNode {
  let p = pos
  let left = parseBoolTerm(tokens, p, errors, warnings)
  
  while (p < tokens.length && tokens[p].type === 'OP' && tokens[p].value === '||') {
    p++
    const right = parseBoolTerm(tokens, p, errors, warnings)
    left = { type: 'BinaryBoolOp', op: '||', left, right }
  }
  
  return left
}

function parseBoolTerm(tokens: Token[], pos: number, errors: string[], warnings: string[]): BoolExprNode {
  let p = pos
  let left = parseBoolFactor(tokens, p, errors, warnings)
  
  while (p < tokens.length && tokens[p].type === 'OP' && tokens[p].value === '&&') {
    p++
    const right = parseBoolFactor(tokens, p, errors, warnings)
    left = { type: 'BinaryBoolOp', op: '&&', left, right }
  }
  
  return left
}

function parseBoolFactor(tokens: Token[], pos: number, errors: string[], warnings: string[]): BoolExprNode {
  if (tokens[pos].type === 'BOOL') {
    return { type: 'BoolLiteral', value: tokens[pos].value === 'true' }
  }
  if (tokens[pos].type === 'IDENT') {
    return { type: 'Identifier', name: tokens[pos].value }
  }
  if (tokens[pos].type === 'LPAREN') {
    const expr = parseBoolExpr(tokens, pos + 1, errors, warnings)
    return expr
  }
  if (tokens[pos].type === 'OP' && tokens[pos].value === '!') {
    p++
    const operand = parseBoolFactor(tokens, pos, errors, warnings)
    return { type: 'UnaryNot', operand }
  }
  // Comparison
  const left = parseExpr(tokens, pos, errors, warnings)
  const op = tokens[pos].value as '<' | '>' | '<=' | '>=' | '==' | '!='
  pos++
  const right = parseExpr(tokens, pos, errors, warnings)
  return { type: 'Comparison', op, left, right }
}

function validateAST(ast: ASTNode): string[] {
  const errors: string[] = []
  
  function walk(node: ASTNode, depth: number) {
    if (depth > 3) {
      errors.push('Nesting depth exceeds 3 levels')
      return
    }
    
    if (node.type === 'IfStatement') {
      // Check that each branch has exactly one action
      if (node.then.length !== 1 || node.then[0].type !== 'Action') {
        errors.push('Each if branch must have exactly one action')
      }
      node.elseIf.forEach((elif) => {
        if (elif.body.length !== 1 || elif.body[0].type !== 'Action') {
          errors.push('Each else if branch must have exactly one action')
        }
      })
      if (node.else && (node.else.length !== 1 || node.else[0].type !== 'Action')) {
        errors.push('Else branch must have exactly one action')
      }
    }
  }
  
  walk(ast, 0)
  return errors
}

// Evaluate AST against battle state
export function evaluateScript(ast: ASTNode, env: Record<string, any>): ActionName {
  if (ast.type !== 'Script') return 'attack' // fallback
  
  for (const node of ast.body) {
    if (node.type === 'Assignment') {
      env[node.varName] = evaluateExpr(node.value, env)
    } else if (node.type === 'IfStatement') {
      if (evaluateBoolExpr(node.condition, env)) {
        return (node.then[0] as any).name
      }
      for (const elif of node.elseIf) {
        if (evaluateBoolExpr(elif.cond, env)) {
          return (elif.body[0] as any).name
        }
      }
      if (node.else && node.else.length > 0) {
        return (node.else[0] as any).name
      }
    } else if (node.type === 'Action') {
      return node.name
    }
  }
  
  return 'attack' // default action
}

function evaluateExpr(expr: ExprNode, env: Record<string, any>): number {
  if (expr.type === 'IntLiteral') return expr.value
  if (expr.type === 'Identifier') return env[expr.name] || 0
  if (expr.type === 'BinaryOp') {
    const left = evaluateExpr(expr.left, env)
    const right = evaluateExpr(expr.right, env)
    switch (expr.op) {
      case '+': return left + right
      case '-': return left - right
      case '*': return left * right
      case '/': return Math.floor(left / right)
      case '%': return left % right
    }
  }
  return 0
}

function evaluateBoolExpr(expr: BoolExprNode, env: Record<string, any>): boolean {
  if (expr.type === 'BoolLiteral') return expr.value
  if (expr.type === 'Identifier') {
    if (expr.name === 'lastEnemyMove') {
      return env[expr.name] !== undefined
    }
    return !!env[expr.name]
  }
  if (expr.type === 'Comparison') {
    const left = evaluateExpr(expr.left, env)
    const right = evaluateExpr(expr.right, env)
    switch (expr.op) {
      case '<': return left < right
      case '>': return left > right
      case '<=': return left <= right
      case '>=': return left >= right
      case '==': return left == right
      case '!=': return left != right
    }
  }
  if (expr.type === 'UnaryNot') return !evaluateBoolExpr(expr.operand, env)
  if (expr.type === 'BinaryBoolOp') {
    const left = evaluateBoolExpr(expr.left, env)
    const right = evaluateBoolExpr(expr.right, env)
    return expr.op === '&&' ? left && right : left || right
  }
  return false
}
