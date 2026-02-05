#!/usr/bin/env node
import { Command } from 'commander';
import { generate } from '../src/lib/generate.js';

const program = new Command();

program
  .name('ncnu')
  .description('NestJS CRUD Generator deeply integrated with @nest-util/nest-crud')
  .version('0.0.1');

program
  .option('-g, --gen <modelName>', 'Generate CRUD for a model (e.g., User)')
  .option('-p, --path <path>', 'Custom path for generation (default: ./)')
  .argument('[fields...]', 'Fields in name:type format (e.g., email:string password:hash)')
  .action(async (fields, options) => {
    const { gen: modelName, path: targetPath } = options;
    
    if (!modelName) {
      console.error('Error: Model name is required via --gen <ModelName>');
      process.exit(1);
    }

    try {
      await generate(modelName, fields, targetPath || './');
    } catch (err) {
      console.error('Error generating files:', err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
