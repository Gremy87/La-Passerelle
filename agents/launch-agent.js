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

  if (!missionId) {
    console.error('❌ --mission-id est requis');
    process.exit(1);
  }

  console.log(`🚀 Lancement agent — Mission #${missionId} : ${title}`);

  // ── Worktree ────────────────────────────────────────────────────────────────
  let cwd = `/tmp/passerelle/mission-${missionId}`;

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
      await log(missionId, `⚠️  Impossible de créer le worktree : ${err.message} — lancement dans /tmp`, 'erreur');
      fs.mkdirSync(cwd, { recursive: true });
    }
  } else {
    // Pas de repo — dossier temp
    fs.mkdirSync(cwd, { recursive: true });
    await log(missionId, `📁 Dossier de travail : ${cwd}`, 'info');
  }

  // ── Import du SDK (ESM) ────────────────────────────────────────────────────
  // Le SDK est installé dans server/node_modules — on résout le chemin absolu
  let query;
  try {
    const sdkCandidates = [
      // Chemin relatif depuis agents/ vers server/node_modules
      path.join(__dirname, '../server/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs'),
      // Via NODE_PATH si défini
      '@anthropic-ai/claude-agent-sdk',
    ];

    let sdkPath = null;
    for (const candidate of sdkCandidates) {
      if (candidate.startsWith('/') && fs.existsSync(candidate)) {
        sdkPath = candidate;
        break;
      }
    }

    let sdk;
    if (sdkPath) {
      // Import par chemin absolu (évite les problèmes NODE_PATH avec ESM)
      sdk = await import(`file://${sdkPath}`);
    } else {
      sdk = await import('@anthropic-ai/claude-agent-sdk');
    }
    query = sdk.query;
  } catch (err) {
    console.error('❌ Impossible de charger @anthropic-ai/claude-agent-sdk :', err.message);
    await log(missionId, `❌ Erreur SDK : ${err.message}`, 'erreur');
    await post('/hooks/agent-error', { mission_id: missionId, error: err.message });
    process.exit(1);
  }

  // ── Lancement de l'agent ───────────────────────────────────────────────────
  await log(missionId, `🤖 Agent démarré — tâche : ${title}`, 'info');

  try {
    const q = query({
      prompt: description,
      options: {
        cwd,
        allowedTools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
        tools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      },
    });

    for await (const message of q) {
      // Filtrer les messages utiles
      if (!message) continue;

      const type = message.type || 'unknown';

      if (type === 'assistant') {
        // Message texte de l'assistant
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              await log(missionId, block.text, 'texte');
            } else if (block.type === 'tool_use') {
              await log(
                missionId,
                `🔧 ${block.name}${block.input ? ': ' + JSON.stringify(block.input).slice(0, 200) : ''}`,
                'tool_use'
              );
            }
          }
        }
      } else if (type === 'tool_result') {
        // Résultat d'un outil
        const result = message.output;
        if (result) {
          const preview = typeof result === 'string'
            ? result.slice(0, 300)
            : JSON.stringify(result).slice(0, 300);
          await log(missionId, `✅ ${preview}`, 'tool_result');
        }
      } else if (type === 'result') {
        // Message final de résultat
        if (message.result) {
          await log(missionId, `🎯 ${message.result}`, 'info');
        }
      } else if (type === 'system') {
        // Message système
        if (message.subtype !== 'init') {
          await log(missionId, `[système] ${JSON.stringify(message).slice(0, 200)}`, 'info');
        }
      }
      // Ignorer les types non pertinents (user, etc.)
    }

    // ── Fin normale ──────────────────────────────────────────────────────────
    console.log(`✅ Mission #${missionId} terminée`);
    await log(missionId, `✅ Mission accomplie — ${title}`, 'info');
    await post('/hooks/task-completed', { mission_id: missionId });

  } catch (err) {
    console.error(`❌ Erreur agent mission #${missionId} :`, err.message);
    await log(missionId, `❌ Erreur agent : ${err.message}`, 'erreur');
    await post('/hooks/agent-error', { mission_id: missionId, error: err.message });
  } finally {
    // Nettoyage worktree optionnel (commenté — l'Amiral peut vouloir inspecter)
    // if (repoPath) removeWorktree(repoPath, missionId);
  }
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err);
  process.exit(1);
});
