import { ref } from 'vue'

export const useFloatingNavPosition = () => {
    const STORAGE_KEY = 'floating-nav-position'

    const defaultPosition = { x: 50, y: 100 }

    const getStoredPosition = () => {
        if (typeof window === 'undefined') return defaultPosition

        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const position = JSON.parse(stored)
                // Validate position is within reasonable bounds
                if (position.x >= 0 && position.y >= 0 &&
                    position.x < window.innerWidth &&
                    position.y < window.innerHeight) {
                    return position
                }
            }
        } catch (error) {
            console.warn('Failed to load floating nav position:', error)
        }

        return defaultPosition
    }

    const savePosition = (position: { x: number; y: number }) => {
        if (typeof window === 'undefined') return

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
        } catch (error) {
            console.warn('Failed to save floating nav position:', error)
        }
    }

    const position = ref(getStoredPosition())

    const updatePosition = (newPosition: { x: number; y: number }) => {
        position.value = newPosition
        savePosition(newPosition)
    }

    return {
        position,
        updatePosition,
        getStoredPosition
    }
}
