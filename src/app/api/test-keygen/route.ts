// src/app/api/test-keygen/route.ts

import { generateKeys } from '@/utils/keyGenerationUtils';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const keys = await generateKeys();
        return NextResponse.json({ success: true, keys });
    } catch (error) {
        return NextResponse.json({ success: false}, { status: 500 });
    }
}