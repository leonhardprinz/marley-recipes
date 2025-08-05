import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'data', 'recipes.json');
    const buf = await fs.readFile(file, 'utf-8');
    return NextResponse.json(JSON.parse(buf));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
