import { NextResponse } from 'next/server';
import { getQueryLogs, clearQueryLogs } from '@/lib/db';

export async function GET() {
  const logs = getQueryLogs();
  return NextResponse.json({ logs });
}

export async function DELETE() {
  clearQueryLogs();
  return NextResponse.json({ success: true, message: 'Query logs cleared' });
}
