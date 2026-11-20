/**
 * The old /chatbot address. The chatbot now lives in the floating widget, so
 * this opens it and returns to the page the user came from (or home).
 */
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { openChat } from '../../components/ChatWidget'

export default function OpenChat() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // The widget lives in the layout, which stays mounted, so open it first and then leave.
    openChat()
    // location.key is "default" when /chatbot was opened directly (bookmark, typed URL).
    if (location.key === 'default') navigate('/', { replace: true })
    else navigate(-1)
  }, [location.key, navigate])

  return null
}
