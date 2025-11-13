'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteAllPosts } from '@/services/api'
import { queryKeys } from '@/lib/queryKeys'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

export function HeaderDeleteAllButton() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: () => deleteAllPosts(),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.posts, exact: false })
      toast.success(res?.message || 'Все посты удалены')
    },
    onError: () => {
      toast.error('Не удалось удалить посты')
    },
  })

  const onConfirm = useCallback(async () => {
    await mutation.mutateAsync()
    setOpen(false)
  }, [mutation])

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className='hidden sm:flex hover:bg-red-100 dark:hover:bg-red-900/20'
          disabled={mutation.isPending}
        >
          Удалить все
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить все посты?</AlertDialogTitle>
          <AlertDialogDescription>
            Действие нельзя отменить. Все сохранённые посты будут удалены.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={mutation.isPending} className='bg-red-600 hover:bg-red-700'>
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}


