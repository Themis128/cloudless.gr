export default defineEventHandler((event) => {
  const path = getRequestPath(event)
  
  // Handle Chrome DevTools specific requests
  if (path.includes('com.chrome.devtools.json')) {
    return {
      name: 'Cloudless',
      description: 'AI-powered low-code platform',
      version: '1.0.0',
      type: 'web-application'
    }
  }
  
  // Handle other .well-known requests
  return {
    status: 'ok',
    message: 'Well-known endpoint accessed',
    path: path
  }
}) 