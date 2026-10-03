import { ActionPage } from './action-page'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ActionPage id={decodeURIComponent(id)} />
}
