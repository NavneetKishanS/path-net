import { NodePage } from './node-page'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <NodePage id={decodeURIComponent(id)} />
}
