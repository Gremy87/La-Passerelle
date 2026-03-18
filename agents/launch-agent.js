#!/usr/bin/env node
/**
 * launch-agent.js — Lance un agent Claude Code pour une mission La Passerelle
 *
 * Usage :
 *   node launch-agent.js --mission-id=X --repo-path=/path --title="..." --description="..."
 *
 * Le script :
 *   1. Parse les arguments
 *   2. Crée un git worktree (si repo_path fourni)
 *   3. Lance Claude Code via @anthropic-ai/claude-agent-sdk
 *   4. Stream chaque message vers /hooks/agent-log
 *   5. POST /hooks/task-completed en fin de mission
 *   6. En cas d'erreur, POST /hooks/agent-error
 */

// ESM dynamique — le sdk est type:module
const BASE_URL = process.env.PASSERELLE_URL || 'http://localhost:3717';

// Parse args --key=value
function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=?(.*)$/);
    if (m) args[m[1]] = m[2] || true;
  }
  return args;
}

const { execSync, exec: execCb } = require('child_process');
const path = require('path');
const fs   = require('fs');
const http = require('http');

// ── Helpers HTTP ──────────────────────────────────────────────────────────────

function post(endpoint, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const opts = {
      hostname: 'localhost',
      port:     3717,
      path:     endpoint,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(opts, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', (err) => {
      console.error(`⚠️  POST ${endpoint} failed: ${err.message}`);
      resolve(); // ne pas bloquer
    });
    req.write(body);
    req.end();
  });
}

function log(missionId, content, type = 'log') {
  return post('/hooks/agent-log', { mission_id: missionId, type, content });
}

// ── Worktree ──────────────────────────────────────────────────────────────────

function createWorktree(repoPath, missionId) {
  const branch       = `passerelle/mission-${missionId}`;
  const worktreePath = `/tmp/passerelle/mission-${missionId}`;

  fs.mkdirSync('/tmp/passerelle', { recursive: true });

  // Supprimer un éventuel worktree résiduel
  try {
    execSync(`git -C "${repoPath}" worktree remove "${worktreePath}" --force`, { stdio: 'ignore' });
  } catch (_) { /* pas grave */ }

  // Supprimer la branche résiduelle si elle existe
  try {
    execSync(`git -C "${repoPath}" branch -D "${branch}"`, { stdio: 'ignore' });
  } catch (_) { /* pas grave */ }

  execSync(
    `git -C "${repoPath}" worktree add "${worktreePath}" -b "${branch}"`,
    { stdio: 'inherit' }
  );
  console.log(`🌿 Worktree créé : ${worktreePath} (branche ${branch})`);
  return { worktreePath, branch };
}

function removeWorktree(repoPath, missionId) {
  if (!repoPath) return;
  const worktreePath = `/tmp/passerelle/mission-${missionId}`;
  try {
    execSync(`git -C "${repoPath}" worktree remove "${worktreePath}" --force`, { stdio: 'ignore' });
    console.log(`🗑️  Worktree supprimé : ${worktreePath}`);
  } catch (err) {
    console.error(`⚠️  Impossible de supprimer le worktree : ${err.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  const missionId   = parseInt(args['mission-id'], 10);
  const repoPath    = args['repo-path'] || null;
  const title       = args['title']       || `Mission #${missionId}`;
  const description = args['description'] || 'Aucune description fournie';
  const skipPerms   = args['skip-permissions'] === 'true';
  const sessionId   = args['session-id'] || null; // Pour --resume

  if (!missionId) {
    console.error('❌ --mission-id est requis');
    process.exit(1);
  }

  console.log(`🚀 Lancement agent — Mission #${missionId} : ${title}`);

  // ── Répertoire de travail ───────────────────────────────────────────────────
  // Par défaut : home de l'utilisateur (hérite du CLAUDE.md et config MCP)
  const userHome = process.env.HOME || require('os').homedir();
  let cwd = userHome;

  if (repoPath && fs.existsSync(repoPath)) {
    try {
      const { worktreePath } = createWorktree(repoPath, missionId);
      cwd = worktreePath;
      await log(missionId, `🌿 Worktree créé : ${worktreePath}`, 'info');

      // Informer le serveur du worktree_path
      await post('/hooks/worktree-created', {
        mission_id:    missionId,
        worktree_path: worktreePath,
      });
    } catch (err) {
      await log(missionId, `⚠️  Impossible de créer le worktree : ${err.message} — lancement dans home`, 'erreur');
    }
  }

  await log(missionId, `📁 Répertoire de travail : ${cwd}`, 'info');

  // ── Lancement via CLI claude (utilise l'abonnement Pro local) ──────────────
  await log(missionId, `🤖 Agent démarré — tâche : ${title}`, 'info');

  const { spawn } = require('child_process');

  try {
    // Chercher le binary claude (Claude Code CLI)
    let claudeBin = 'claude';
    const possiblePaths = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      `${process.env.HOME}/.local/bin/claude`,
      `${process.env.HOME}/.npm-global/bin/claude`,
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) { claudeBin = p; break; }
    }

    await new Promise((resolve, reject) => {
      const claudeArgs = [
        '--print',                    // Mode non-interactif : print output et quitte
        '--output-format', 'stream-json', // Stream JSON pour parser les events
        '--verbose',
      ];
      if (skipPerms)  claudeArgs.push('--dangerously-skip-permissions');
      if (sessionId)  claudeArgs.push('--resume', sessionId);
      claudeArgs.push(description);
      const args = claudeArgs;

      const proc = spawn(claudeBin, args, {
        cwd,
        env: { ...process.env, FORCE_COLOR: '0', ANTHROPIC_API_KEY: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let buffer = '';
      let capturedSessionId = null; // Session ID Claude pour --resume

      proc.stdout.on('data', async (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // garder la ligne incomplète

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            const type = event.type;

            // Capturer le session_id dès qu'il apparaît
            if (event.session_id && !capturedSessionId) {
              capturedSessionId = event.session_id;
              await post('/hooks/session-id', { mission_id: missionId, session_id: capturedSessionId });
              console.log(`🔑 Session ID capturé : ${capturedSessionId}`);
            }

            if (type === 'assistant') {
              const content = event.message?.content || [];
              for (const block of content) {
                if (block.type === 'text' && block.text) {
                  await log(missionId, block.text, 'texte');
                } else if (block.type === 'tool_use') {
                  await log(missionId, `🔧 ${block.name}: ${JSON.stringify(block.input || {}).slice(0, 200)}`, 'tool_use');
                }
              }
            } else if (type === 'result') {
              if (event.result) await log(missionId, `🎯 ${event.result}`, 'info');
            }
          } catch {
            // Ligne non-JSON (logs texte bruts) — on log quand même
            if (line.trim()) await log(missionId, line.trim(), 'texte');
          }
        }
      });

      proc.stderr.on('data', async (chunk) => {
        const txt = chunk.toString().trim();
        if (txt) await log(missionId, `⚠️ ${txt}`, 'erreur');
      });

      // ── Polling messages entrants ──────────────────────────────────────────
      // Récupère les messages 'amiral' depuis la DB pour les injecter dans stdin
      // Note: avec --print le stdin est 'ignore', on log uniquement pour traçabilité
      let lastMessageId = 0;
      const pollMessages = setInterval(async () => {
        try {
          const result = await new Promise((res) => {
            const opts = {
              hostname: 'localhost',
              port:     3717,
              path:     `/api/missions/${missionId}/messages?since=${lastMessageId}`,
              method:   'GET',
            };
            const req = http.request(opts, (response) => {
              let data = '';
              response.on('data', (chunk) => { data += chunk; });
              response.on('end', () => {
                try { res(JSON.parse(data)); } catch { res([]); }
              });
            });
            req.on('error', () => res([]));
            req.end();
          });

          const amiralMessages = Array.isArray(result)
            ? result.filter(m => m.role === 'amiral')
            : [];

          for (const msg of amiralMessages) {
            if (msg.id > lastMessageId) lastMessageId = msg.id;
            // Tenter d'injecter dans stdin si le process est interactif
            // Avec --print, stdin est 'ignore' donc on log pour traçabilité
            if (proc.stdin && proc.stdin.writable) {
              proc.stdin.write(msg.contenu + '\n');
              console.log(`💬 Message injecté dans stdin : ${msg.contenu.slice(0, 80)}`);
            } else {
              console.log(`💬 Message amiral (stdin non disponible): ${msg.contenu.slice(0, 80)}`);
              // TODO: quand claude CLI supportera l'injection interactive, utiliser stdin
            }
          }
        } catch (err) {
          // Polling silencieux
        }
      }, 3000); // Poll toutes les 3 secondes

      proc.on('close', (code) => {
        clearInterval(pollMessages);
        if (code === 0 || code === null) resolve();
        else reject(new Error(`Claude CLI exited with code ${code}`));
      });

      proc.on('error', (err) => {
        clearInterval(pollMessages);
        reject(new Error(`Impossible de lancer claude CLI: ${err.message}`));
      });
    });

    console.log(`✅ Mission #${missionId} terminée`);
    await log(missionId, `✅ Mission accomplie — ${title}`, 'info');
    await post('/hooks/task-completed', { mission_id: missionId });

  } catch (err) {
    console.error(`❌ Erreur agent mission #${missionId} :`, err.message);
    await log(missionId, `❌ Erreur agent : ${err.message}`, 'erreur');
    await post('/hooks/agent-error', { mission_id: missionId, error: err.message });
  } finally {
    // Nettoyage worktree optionnel
    // if (repoPath) removeWorktree(repoPath, missionId);
  }
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err);
  process.exit(1);
});
