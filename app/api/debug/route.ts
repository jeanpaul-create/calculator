export async function GET() {
  return Response.json({
    hasSecret: !!process.env.NEXTAUTH_SECRET,
    secretLen: process.env.NEXTAUTH_SECRET?.length ?? 0,
    hasUrl: !!process.env.NEXTAUTH_URL,
    url: process.env.NEXTAUTH_URL,
    hasDb: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
  })
}
