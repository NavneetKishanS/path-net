import { RoleHome } from '@/components/home/role-home'
import { FollowedTopics } from '@/components/account/followed-topics'

export default function Home() {
  return (
    <>
      <FollowedTopics />
      <RoleHome />
    </>
  )
}
