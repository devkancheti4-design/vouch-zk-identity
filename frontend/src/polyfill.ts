/**
 * circomlibjs is written for Node and reaches for Buffer (and occasionally process).
 * This module is imported FIRST by main.tsx, so it finishes evaluating before any module that
 * needs them. Without it the page renders blank with "Buffer is not defined".
 */
import { Buffer } from "buffer";
import process from "process";

const g = globalThis as unknown as { Buffer?: unknown; process?: unknown; global?: unknown };
if (!g.Buffer) g.Buffer = Buffer;
if (!g.process) g.process = process;
if (!g.global) g.global = globalThis;
