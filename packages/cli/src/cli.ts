#!/usr/bin/env node

import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { execaCommand } from 'execa';

interface ProjectConfig {
  framework: 'nextjs' | 'express' | 'hono' | 'vercel' | 'generic';
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  apiKey: string;
  installLocation: string;
}

// Detect project type
async function detectFramework(cwd: string): Promise<ProjectConfig['framework']> {
  const packageJsonPath = path.join(cwd, 'package.json');
  
  if (!await fs.pathExists(packageJsonPath)) {
    return 'generic';
  }

  const packageJson = await fs.readJSON(packageJsonPath);
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  if (deps['next']) return 'nextjs';
  if (deps['express']) return 'express';
  if (deps['hono']) return 'hono';
  if (deps['@vercel/node']) return 'vercel';
  
  return 'generic';
}

// Detect package manager
async function detectPackageManager(cwd: string): Promise<ProjectConfig['packageManager']> {
  if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (await fs.pathExists(path.join(cwd, 'bun.lockb'))) return 'bun';
  return 'npm';
}

// Check if OpenAI is being used
async function detectAIProviders(cwd: string): Promise<string[]> {
  const providers: string[] = [];
  const packageJsonPath = path.join(cwd, 'package.json');
  
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJSON(packageJsonPath);
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps['openai']) providers.push('OpenAI');
    if (deps['@anthropic-ai/sdk']) providers.push('Anthropic');
    if (deps['@google/generative-ai']) providers.push('Google AI');
    if (deps['cohere-ai']) providers.push('Cohere');
  }

  return providers;
}

// Install agentcache-client
async function installPackage(config: ProjectConfig, cwd: string): Promise<void> {
  const spinner = ora('Installing agentcache-client...').start();
  
  try {
    const commands = {
      npm: 'npm install agentcache-client',
      pnpm: 'pnpm add agentcache-client',
      yarn: 'yarn add agentcache-client',
      bun: 'bun add agentcache-client'
    };

    await execaCommand(commands[config.packageManager], { cwd });
    spinner.succeed('Installed agentcache-client');
  } catch (error) {
    spinner.fail('Failed to install package');
    throw error;
  }
}

// Create config file
async function createConfigFile(config: ProjectConfig, cwd: string): Promise<void> {
  const spinner = ora('Creating agentcache.config.js...').start();
  
  const configContent = `// AgentCache Configuration
// Learn more: https://agentcache.ai/docs

module.exports = {
  apiKey: process.env.AGENTCACHE_API_KEY || '${config.apiKey}',
  
  // Cache settings
  defaultTTL: 604800, // 7 days in seconds
  
  // Providers to cache (auto-detected)
  providers: ['openai', 'anthropic', 'google-ai'],
  
  // Enable/disable caching
  enabled: process.env.NODE_ENV !== 'development', // Cache in prod only
  
  // Namespace for multi-tenant apps
  namespace: undefined,
  
  // Logging
  debug: process.env.NODE_ENV === 'development',
};
`;

  await fs.writeFile(path.join(cwd, 'agentcache.config.js'), configContent);
  spinner.succeed('Created agentcache.config.js');
}

// Update .env file
async function updateEnvFile(config: ProjectConfig, cwd: string): Promise<void> {
  const spinner = ora('Updating .env file...').start();
  
  const envPath = path.join(cwd, '.env');
  const envLocalPath = path.join(cwd, '.env.local');
  
  const envLine = `\n# AgentCache API Key\nAGENTCACHE_API_KEY=${config.apiKey}\n`;
  
  // Prefer .env.local for Next.js projects
  const targetPath = config.framework === 'nextjs' && await fs.pathExists(envLocalPath) 
    ? envLocalPath 
    : envPath;

  if (await fs.pathExists(targetPath)) {
    const content = await fs.readFile(targetPath, 'utf-8');
    if (!content.includes('AGENTCACHE_API_KEY')) {
      await fs.appendFile(targetPath, envLine);
      spinner.succeed(`Updated ${path.basename(targetPath)}`);
    } else {
      spinner.info('AGENTCACHE_API_KEY already exists in .env');
    }
  } else {
    await fs.writeFile(targetPath, envLine);
    spinner.succeed(`Created ${path.basename(targetPath)}`);
  }
}

// Create example integration file
async function createExampleFile(config: ProjectConfig, cwd: string): Promise<void> {
  const spinner = ora('Creating example integration...').start();
  
  const examples = {
    nextjs: {
      path: 'app/api/chat/route.ts',
      content: `import { NextResponse } from 'next/server';
import { AgentCache } from 'agentcache-client';
import OpenAI from 'openai';

const cache = new AgentCache(process.env.AGENTCACHE_API_KEY!);
const openai = new OpenAI();

export async function POST(request: Request) {
  const { messages } = await request.json();

  // 1. Check cache first
  const cached = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages
  });

  if (cached.hit) {
    console.log('✅ Cache hit!', cached.latency_ms + 'ms');
    return NextResponse.json(cached.response);
  }

  // 2. Call OpenAI if cache miss
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages
  });

  // 3. Store in cache for next time
  await cache.set({
    provider: 'openai',
    model: 'gpt-4',
    messages
  }, completion);

  return NextResponse.json(completion);
}
`
    },
    express: {
      path: 'routes/chat.js',
      content: `const { AgentCache } = require('agentcache-client');
const OpenAI = require('openai');

const cache = new AgentCache(process.env.AGENTCACHE_API_KEY);
const openai = new OpenAI();

async function chatHandler(req, res) {
  const { messages } = req.body;

  // 1. Check cache first
  const cached = await cache.get({
    provider: 'openai',
    model: 'gpt-4',
    messages
  });

  if (cached.hit) {
    console.log('✅ Cache hit!', cached.latency_ms + 'ms');
    return res.json(cached.response);
  }

  // 2. Call OpenAI if cache miss
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages
  });

  // 3. Store in cache
  await cache.set({
    provider: 'openai',
    model: 'gpt-4',
    messages
  }, completion);

  res.json(completion);
}

module.exports = { chatHandler };
`
    },
    generic: {
      path: 'agentcache-example.js',
      content: `// AgentCache Example Integration
// Copy this code into your API routes

const { AgentCache } = require('agentcache-client');
const cache = new AgentCache(process.env.AGENTCACHE_API_KEY);

async function cachedLLMCall(provider, model, messages) {
  // 1. Check cache
  const cached = await cache.get({ provider, model, messages });
  
  if (cached.hit) {
    console.log('✅ Cache hit! Saved', cached.latency_ms + 'ms');
    return cached.response;
  }

  // 2. Call your LLM provider
  const response = await yourLLMProvider.chat({
    model,
    messages
  });

  // 3. Store in cache
  await cache.set({ provider, model, messages }, response);

  return response;
}

module.exports = { cachedLLMCall };
`
    }
  };

  const example = examples[config.framework] || examples.generic;
  const examplePath = path.join(cwd, example.path);

  // Create directory if it doesn't exist
  await fs.ensureDir(path.dirname(examplePath));
  await fs.writeFile(examplePath, example.content);
  
  spinner.succeed(`Created example: ${example.path}`);
}

// Main CLI function
async function main() {
  console.log('\n' + chalk.cyan.bold('╔═══════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   AgentCache CLI Installer   ║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════╝') + '\n');

  const cwd = process.cwd();
  
  // Detect project
  const detectedFramework = await detectFramework(cwd);
  const detectedPm = await detectPackageManager(cwd);
  const detectedProviders = await detectAIProviders(cwd);

  console.log(chalk.gray('Auto-detected:'));
  console.log(chalk.gray(`  Framework: ${detectedFramework}`));
  console.log(chalk.gray(`  Package manager: ${detectedPm}`));
  if (detectedProviders.length > 0) {
    console.log(chalk.gray(`  AI Providers: ${detectedProviders.join(', ')}`));
  }
  console.log();

  // Interactive prompts
  const response = await prompts([
    {
      type: 'select',
      name: 'framework',
      message: 'Select your framework:',
      choices: [
        { title: 'Next.js', value: 'nextjs' },
        { title: 'Express', value: 'express' },
        { title: 'Hono', value: 'hono' },
        { title: 'Vercel Serverless', value: 'vercel' },
        { title: 'Generic / Other', value: 'generic' }
      ],
      initial: ['nextjs', 'express', 'hono', 'vercel'].indexOf(detectedFramework)
    },
    {
      type: 'select',
      name: 'packageManager',
      message: 'Select your package manager:',
      choices: [
        { title: 'npm', value: 'npm' },
        { title: 'pnpm', value: 'pnpm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'bun', value: 'bun' }
      ],
      initial: ['npm', 'pnpm', 'yarn', 'bun'].indexOf(detectedPm)
    },
    {
      type: 'text',
      name: 'apiKey',
      message: 'Enter your AgentCache API key:',
      validate: (value: string) => {
        if (!value.startsWith('ac_')) {
          return 'API key must start with ac_ (demo: ac_demo_test123)';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'installPackage',
      message: 'Install agentcache-client package?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'createConfig',
      message: 'Create agentcache.config.js?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'updateEnv',
      message: 'Add API key to .env file?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'createExample',
      message: 'Create example integration file?',
      initial: true
    }
  ]);

  // Handle cancellation
  if (!response.apiKey) {
    console.log(chalk.yellow('\n✖ Setup cancelled'));
    process.exit(0);
  }

  const config: ProjectConfig = {
    framework: response.framework,
    packageManager: response.packageManager,
    apiKey: response.apiKey,
    installLocation: cwd
  };

  console.log();

  try {
    // Execute setup steps
    if (response.installPackage) {
      await installPackage(config, cwd);
    }

    if (response.createConfig) {
      await createConfigFile(config, cwd);
    }

    if (response.updateEnv) {
      await updateEnvFile(config, cwd);
    }

    if (response.createExample) {
      await createExampleFile(config, cwd);
    }

    // Success message
    console.log();
    console.log(chalk.green.bold('✓ AgentCache setup complete!'));
    console.log();
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.gray('  1. Review agentcache.config.js'));
    console.log(chalk.gray('  2. Check the example integration file'));
    console.log(chalk.gray('  3. Start your dev server and test caching'));
    console.log();
    console.log(chalk.cyan('Documentation:'));
    console.log(chalk.gray('  https://agentcache.ai/docs'));
    console.log();
    console.log(chalk.cyan('Dashboard:'));
    console.log(chalk.gray('  https://agentcache.ai/dashboard-new.html'));
    console.log();

  } catch (error) {
    console.error(chalk.red('\n✖ Setup failed:'), error);
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
