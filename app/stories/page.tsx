'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'

interface Story {
  id: string
  content: string
  type: string
  imageUrl: string
  vendor: {
    id: string
    name: string
    isPremium: boolean
  } | null
}

export default function StoriesPage() {
  const router = useRouter()
  const [stories, setStories] = useState<Story[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStories()
  }, [])

  const fetchStories = async () => {
    try {
      const response = await fetch('/api/stories')
      const data = await response.json()
      setStories(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= stories.length - 1) {
          router.push('/')
          return prev
        }
        return prev + 1
      })
    }, 5000)

    return () => clearInterval(timer)
  }, [stories, router])

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, background: 'var(--black)' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid var(--glass-border)', borderTopColor: 'var(--rum)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </main>
    )
  }

  if (stories.length === 0) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, background: 'var(--black)' }}>
        <p style={{ color: 'var(--sand-dim)' }}>Nuh nuh stories</p>
      </main>
    )
  }

  const currentStory = stories[currentIndex]

  return (
    <main style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--black)', display: 'flex', flexDirection: 'column' }}>
      {/* Progress bars */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', display: 'flex', gap: '4px', zIndex: 10 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: '2px', background: 'rgba(255,255,255,0.2)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'var(--sand)',
              width: i < currentIndex ? '100%' : i === currentIndex ? '50%' : '0%',
              transition: 'width 0.3s'
            }} />
          </div>
        ))}
      </div>

      {/* Story content */}
      <div style={{ position: 'relative', flex: 1, backgroundImage: `url(${currentStory.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.3), rgba(15,14,12,0.7))' }} />

        {/* Header */}
        <div style={{ position: 'absolute', top: '32px', left: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 5 }}>
          {currentStory.vendor && (
            <>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: currentStory.vendor.isPremium ? '2px solid var(--gold)' : '2px solid var(--sand)',
                background: 'var(--glass-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700
              }}>
                {currentStory.vendor.name.charAt(0)}
              </div>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{currentStory.vendor.name}</span>
              {currentStory.vendor.isPremium && (
                <span style={{ fontSize: '9px', background: 'var(--gradient-gold)', color: 'var(--black)', fontWeight: 800, padding: '2px 6px', borderRadius: '999px' }}>
                  PREMIUM
                </span>
              )}
            </>
          )}

          <button
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--sand)', cursor: 'pointer' }}
            onClick={() => router.push('/')}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Story text */}
        <div style={{ position: 'absolute', bottom: '40px', left: '16px', zIndex: 5 }}>
          <p style={{ fontSize: '18px', fontWeight: 700 }}>{currentStory.content}</p>
        </div>
      </div>
    </main>
  )
}