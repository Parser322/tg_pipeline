 'use client'
 import { Separator } from "@/components/ui/separator"
 import { SidebarTrigger } from "@/components/ui/sidebar"
 import { usePathname } from "next/navigation"
 import { useMemo } from "react"
 import { HeaderDeleteAllButton } from "@/components/HeaderDeleteAllButton"

export function SiteHeader() {
   const pathname = usePathname()
   const title = useMemo(() => {
     const mapping: Record<string, string> = {
       "/": "Панель управления",
       "/posts": "Посты",
       "/settings": "Настройки",
     }
     // Ищем самое длинное совпадение по префиксу
     const match = Object.keys(mapping)
       .sort((a, b) => b.length - a.length)
       .find((p) => pathname === p || pathname.startsWith(p + "/"))
     return match ? mapping[match] : ""
   }, [pathname])
  return (
      <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[var(--header-height)] md:peer-data-[variant=inset]:rounded-t-xl">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 text-foreground" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
         {title && <h1 className="text-base font-medium">{title}</h1>}
          <div className="ml-auto flex items-center gap-2">
            {pathname === '/posts' && <HeaderDeleteAllButton />}
          </div>
      </div>
    </header>
  )
}


