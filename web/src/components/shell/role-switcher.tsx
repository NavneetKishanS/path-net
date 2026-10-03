'use client'

import { Select } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { ROLE_CONFIG, ROLES, isRole } from '@/lib/roles'
import { useRole } from '@/components/role/role-provider'

export function RoleSwitcher() {
  const { role, config, setRole } = useRole()
  return (
    <div className="flex items-center gap-2">
      <span id="role-label" className="hidden text-label text-ink-3 lg:inline">
        Viewing as
      </span>
      <Select.Root value={role} onValueChange={(v) => isRole(v) && setRole(v)}>
        <Select.Trigger
          aria-labelledby="role-label"
          aria-label={`Viewing as ${config.label}`}
          data-testid="role-switcher"
          className="inline-flex h-8 items-center gap-2 rounded-sm border border-line-strong bg-paper px-2.5 text-label font-medium text-ink hover:bg-surface"
        >
          <Select.Value>{config.label}</Select.Value>
          <Select.Icon>
            <ChevronDown className="size-3.5 text-ink-3" aria-hidden />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            align="end"
            className="z-50 w-[300px] rounded-md border border-line bg-paper p-1 shadow-[0_8px_24px_-12px_oklch(0.2_0.02_255/0.3)]"
          >
            <Select.Viewport>
              {ROLES.map((r) => (
                <Select.Item
                  key={r}
                  value={r}
                  className="relative cursor-default rounded-sm py-2 pr-2 pl-7 outline-none select-none data-[highlighted]:bg-surface"
                >
                  <Select.ItemIndicator className="absolute top-2.5 left-2">
                    <Check className="size-3.5 text-accent" aria-hidden />
                  </Select.ItemIndicator>
                  <Select.ItemText>
                    <span className="block text-ui font-medium text-ink">{ROLE_CONFIG[r].label}</span>
                  </Select.ItemText>
                  <span className="block text-label text-ink-3">{ROLE_CONFIG[r].description}</span>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}
