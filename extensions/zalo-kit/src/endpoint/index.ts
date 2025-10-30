/* eslint-disable no-console */
import { defineEndpoint } from '@directus/extensions-sdk'
import { ThreadType } from 'zca-js'
import ZaloService from './services/ZaloService' // Assuming ZaloService is correctly imported

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`
}

export default defineEndpoint(async (router, { database, getSchema, services }) => {
  const { ItemsService } = services

  // Initialize or get the ZaloService instance
  let zaloService: ZaloService
  try {
    // Use the static getInstance method as per the refactored service
    zaloService = ZaloService.getInstance()
    console.warn('[Zalo Endpoint] Using existing ZaloService instance')
  }
  catch {
    // Use the static init method as per the refactored service
    zaloService = ZaloService.init(getSchema, ItemsService)
    console.warn('[Zalo Endpoint] Created new ZaloService instance')
  }

  // POST /zalo/init - Initiate QR code login
  router.post('/init', async (req, res) => {
    try {
      // Use the refactored method name
      const result = await zaloService.loginInitiate()
      res.json(result)
    }
    catch (error: any) {
      console.error('[Zalo Endpoint] Init error:', error)
      res.status(500).json({
        error: error.message,
        status: 'logged_out',
        qrCode: null,
        isListening: false,
        userId: null,
      })
    }
  })

  // POST /zalo/login/cookies - Login using cookies from Zalo Extractor
  router.post('/login/cookies', async (req, res) => {
    try {
      const { cookies, imei, userAgent } = req.body

      if (!cookies || !imei || !userAgent) {
        return res.status(400).json({
          ok: false,
          message: 'Missing required fields: cookies, imei, userAgent',
        })
      }

      if (!Array.isArray(cookies) || cookies.length === 0) {
        return res.status(400).json({
          ok: false,
          message: 'Cookies must be a non-empty array',
        })
      }
      res.json({
        ok: true,
        message: 'Login session is being initialized...',
      });

      // Run the import in the background
      (async () => {
        try {
          // Use the refactored method name
          await zaloService.loginImportSession(
            imei,
            userAgent,
            cookies,
          )
        }
        catch (err) {
          console.error('[ZaloService] Background cookie login failed:', err)
        }
      })()
    }
    catch (error: any) {
      console.error('[Zalo Endpoint] Cookies Login error:', error)
      res.status(500).json({
        ok: false,
        message: error.message,
      })
    }
  })

  // GET /zalo/status - Get current login status
  router.get('/status', async (req, res) => {
    try {
      // Use the refactored method name
      const status = zaloService.loginGetStatus()
      res.json(status)
    }
    catch (error: any) {
      console.error('[Zalo Endpoint] Status error:', error)
      res.status(500).json({
        error: error.message,
        status: 'logged_out',
        qrCode: null,
        isListening: false,
        userId: null,
      })
    }
  })

  // POST /zalo/logout - Logout
  router.post('/logout', async (req, res) => {
    try {
      // Use the refactored method name
      await zaloService.loginLogout()
      res.json({
        success: true,
        message: 'Logged out successfully',
      })
    }
    catch (error: any) {
      console.error('[Zalo Endpoint] Logout error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // GET /zalo/session - Get session info
  router.get('/session', async (req, res) => {
    try {
      // Use the refactored method name
      const session = await zaloService.sessionGetInfo()

      if (session) {
        res.json({
          exists: true,
          userId: session.userId,
          loginTime: session.loginTime,
          isActive: session.isActive,
        })
      }
      else {
        res.json({ exists: false })
      }
    }
    catch (error: any) {
      console.error('[Zalo Endpoint] Session error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // GET /zalo/me - Get basic status about the currently logged-in user
  router.get('/me', (req, res) => {
    try {
      // Use the refactored method name
      const status = zaloService.loginGetStatus()
      res.json({
        userId: status.userId,
        status: status.status,
        isListening: status.isListening,
      })
    }
    catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // POST /zalo/send - Send a message
  router.post('/send', async (req, res) => {
    try {
      const { conversationId, message, content, clientId, attachments } = req.body
      const messageContent = message || content

      // 1. Validation
      if (!conversationId || (!messageContent && (!attachments || attachments.length === 0))) {
        return res.status(400).json({
          error: 'conversationId and (message or attachments) are required',
        })
      }

      const status = zaloService.loginGetStatus()
      if (status.status !== 'logged_in') {
        console.error('[Endpoint /send] Zalo not logged in')
        return res.status(503).json({
          error: 'Zalo is not connected',
          status: status.status,
        })
      }

      const zaloUserId = status.userId

      let zaloThreadId: string | null = null
      let threadType: typeof ThreadType.User | typeof ThreadType.Group

      try {
        const [conversation] = await database('zalo_conversations')
          .where('id', conversationId)
          .select(['participant_id', 'group_id'])
          .limit(1)

        if (!conversation) {
          console.error('[Endpoint /send] Conversation not found')
          return res.status(404).json({
            error: 'Conversation not found in database',
            conversationId,
          })
        }

        if (conversation.group_id && conversation.group_id !== null) {
          zaloThreadId = conversation.group_id
          threadType = ThreadType.Group
        }
        else if (conversation.participant_id && conversation.participant_id !== null) {
          zaloThreadId = conversation.participant_id
          threadType = ThreadType.User
        }
        else {
          return res.status(400).json({
            error: 'Cannot determine Zalo thread ID',
            conversationId,
            conversation,
          })
        }

        if (!zaloThreadId) {
          return res.status(400).json({
            error: 'Invalid thread ID',
            conversationId,
            conversation,
          })
        }
      }
      catch (dbError: any) {
        return res.status(500).json({
          error: 'Failed to query conversation',
          details: dbError.message,
        })
      }

      // Send message to Zalo
      let zaloResult: any
      try {
        // Build message content with file links
        let finalMessage = messageContent || ''

        // If we have attachments, add download links
        if (attachments && attachments.length > 0) {
          console.log(`📎 Adding ${attachments.length} file link(s) to message`)

          const fileLinks: string[] = []

          for (const attachment of attachments) {
            try {
              // Get file from Directus storage
              const fileResponse = await database('directus_files')
                .where('id', attachment.fileId || attachment.id)
                .first()

              if (!fileResponse) {
                console.error('File not found in database:', attachment.fileId)
                continue
              }

              // Create public download link
              const fileUrl = `http://localhost:8055/assets/${fileResponse.id}?download`
              const fileName = attachment.filename || fileResponse.filename_download
              const fileSize = formatFileSize(attachment.size || fileResponse.filesize)

              // Add to message
              fileLinks.push(`📎 ${fileName} (${fileSize})\n🔗 ${fileUrl}`)

              console.log(`✅ Added file link: ${fileName}`)
            }
            catch (fileError) {
              console.error(`Failed to process file ${attachment.filename}:`, fileError)
            }
          }

          // Append file links to message
          if (fileLinks.length > 0) {
            if (finalMessage) {
              finalMessage = `${finalMessage}\n\n${fileLinks.join('\n\n')}`
            }
            else {
              finalMessage = fileLinks.join('\n\n')
            }
          }
        }

        // Send message to Zalo (text only with file links)
        if (finalMessage) {
          zaloResult = await zaloService.apiSendMessage(
            { msg: finalMessage },
            zaloThreadId,
            threadType,
          )
        }
        else {
          throw new Error('No message content to send')
        }
      }
      catch (zaloError: any) {
        console.error('Zalo API Error:', zaloError)

        if (zaloError.code === 114) {
          return res.status(400).json({
            error: 'Invalid Zalo thread ID',
            details: 'The recipient does not exist or has blocked you',
            zaloThreadId,
            code: 114,
          })
        }

        return res.status(500).json({
          error: 'Failed to send message via Zalo',
          details: zaloError.message,
          code: zaloError.code,
          threadId: zaloThreadId,
        })
      }

      const messageId = zaloResult?.message?.msgId
        || zaloResult?.data?.msgId
        || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const clientMsgId = clientId || messageId

      const [sender] = await database('zalo_users')
        .where('id', zaloUserId)
        .select(['id', 'display_name', 'avatar_url', 'zalo_name'])
        .limit(1)

      const timestamp = new Date()

      try {
        const existingMessage = await database('zalo_messages')
          .where(function () {
            this.where('id', messageId)
              .orWhere('client_id', clientMsgId)
          })
          .first()

        if (existingMessage) {
          // Get attachments from zalo_attachments table
          const messageAttachments = await database('zalo_attachments')
            .where('message_id', existingMessage.id)
            .select('*')

          return res.json({
            success: true,
            message: 'Message already processed',
            data: {
              id: existingMessage.id,
              conversationId: existingMessage.conversation_id,
              content: existingMessage.content,
              sent_at: existingMessage.sent_at,
              attachments: messageAttachments,
            },
          })
        }

        await database('zalo_messages')
          .insert({
            id: messageId,
            client_id: clientMsgId,
            conversation_id: conversationId,
            content: messageContent || '',
            sender_id: zaloUserId,
            sent_at: timestamp,
            received_at: timestamp,
            is_edited: false,
            is_undone: false,
            raw_data: zaloResult,
            created_at: timestamp,
            updated_at: timestamp,
          })
          .onConflict('id')
          .ignore() // Ignore duplicates instead of merge

        // Save attachments to zalo_attachments table if present
        if (attachments && attachments.length > 0) {
          console.log(`💾 Saving ${attachments.length} attachment(s) to database`)
          const attachmentRecords = attachments.map((att: any, index: number) => ({
            message_id: messageId,
            file_type: att.type || 'file',
            file_name: att.filename || `file_${index}`,
            file_url: att.url || `/assets/${att.fileId || att.id}`,
            file_size: att.size || null,
            thumbnail_url: att.thumbnail || null,
            duration: att.duration || null,
            zalo_id: att.id || att.fileId || null,
            created_at: timestamp,
          }))

          await database('zalo_attachments').insert(attachmentRecords).onConflict().ignore()
        }

        await database('zalo_conversations')
          .where('id', conversationId)
          .update({
            last_message_id: messageId,
            last_message_time: timestamp,
            updated_at: timestamp,
          })

        return res.json({
          success: true,
          message: 'Message sent successfully',
          data: {
            messageId,
            id: messageId,
            conversationId,
            content: messageContent,
            sent_at: timestamp.toISOString(),
            sender_id: zaloUserId,
            client_id: clientMsgId,
            thread_id: zaloThreadId,
            sender: {
              id: sender?.id,
              display_name: sender?.display_name,
              avatar_url: sender?.avatar_url,
              zalo_name: sender?.zalo_name,
            },
          },
        })
      }
      catch (dbError: any) {
        console.error('Database Error:', dbError)
        return res.status(207).json({
          success: true,
          warning: 'Message sent to Zalo but failed to save to database',
          data: {
            messageId,
            error: dbError.message,
          },
        })
      }
    }
    catch (error: any) {
      console.error('Internal Error:', error)
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message,
      })
    }
  })

  // GET /zalo/conversations - Get recent conversations
  router.get('/conversations', async (req, res) => {
    try {
      console.log('[Endpoint] Loading conversations...')

      // Optimized Query: Fetch conversations directly, ordering by last_message_time
      const conversationsData = await database('zalo_conversations')
        .select([
          'zalo_conversations.id',
          'zalo_conversations.type',
          'zalo_conversations.last_message_time as timestamp',
          'zalo_conversations.last_message_id',
          'zalo_conversations.participant_id', // For direct chats
          'zalo_groups.name as group_name', // Join for group name
          'zalo_groups.avatar_url as group_avatar',
          'zalo_users.display_name as user_display_name', // Join for user name
          'zalo_users.avatar_url as user_avatar',
          'zalo_users.zalo_name as user_zalo_name',
          'last_msg.content as lastMessage', // Join for last message content
          'last_msg.sender_id as last_sender_id', // Needed to determine sender if needed later
        ])
        .leftJoin('zalo_groups', 'zalo_conversations.group_id', 'zalo_groups.id')
        .leftJoin('zalo_users', 'zalo_conversations.participant_id', 'zalo_users.id')
        .leftJoin('zalo_messages as last_msg', 'zalo_conversations.last_message_id', 'last_msg.id')
        .orderBy('zalo_conversations.last_message_time', 'desc')
        .limit(100) // Limit results for performance

      console.log('[Endpoint] Conversations data fetched:', conversationsData.length)

      const conversations = conversationsData.map((conv: any) => {
        let name: string
        let avatar: string | null

        if (conv.type === 'group') {
          name = conv.group_name || `Group ${conv.id}`
          avatar = conv.group_avatar
        }
        else {
          // For direct chats, use participant info
          name = conv.user_display_name || conv.user_zalo_name || conv.participant_id || 'Unknown User'
          avatar = conv.user_avatar
        }

        // Fallback avatar using ui-avatars
        if (!avatar) {
          const avatarName = name === 'Unknown User' ? '?' : name.charAt(0).toUpperCase()
          avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=random`
        }

        return {
          id: conv.id,
          name,
          avatar,
          lastMessage: conv.lastMessage || '',
          timestamp: conv.timestamp,
          // Placeholder values - implement logic if needed
          unreadCount: 0,
          online: true, // Placeholder
        }
      })

      console.log('[Endpoint] Processed Conversations:', conversations.length)

      res.json({
        data: conversations,
      })
    }
    catch (error: any) {
      console.error('❌ [Endpoint /conversations] Error:', error)
      res.status(500).json({ error: 'Failed to fetch conversations', details: error.message })
    }
  })

  // GET /zalo/messages/:conversationId - Get messages for a conversation
  router.get('/messages/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params
      console.log('[Endpoint] Loading messages for:', conversationId)

      // Get messages
      const messages = await database('zalo_messages')
        .where('conversation_id', conversationId)
        .select(['id', 'sender_id', 'content', 'sent_at', 'is_edited', 'raw_data']) // Select needed fields
        .orderBy('sent_at', 'asc') // Order chronologically
        .limit(200) // Add a limit for performance

      console.log('[Endpoint] Messages fetched:', messages.length)

      // Get unique sender IDs
      const senderIds = [...new Set(messages.map((m: any) => m.sender_id).filter(id => id))] // Filter null/undefined

      let userMap = new Map()

      if (senderIds.length > 0) {
        // Fetch user info for senders
        const users = await database('zalo_users')
          .whereIn('id', senderIds)
          .select(['id', 'display_name', 'avatar_url', 'zalo_name'])

        console.log('[Endpoint] Users fetched:', users.length)
        userMap = new Map(users.map((u: any) => [u.id, u]))
      }
      else {
        console.log('[Endpoint] No sender IDs found in messages.')
      }

      // Enrich messages with sender info
      const enrichedMessages = messages.map((msg: any) => {
        const user = userMap.get(msg.sender_id)
        const senderName = user?.display_name || user?.zalo_name || msg.sender_id || 'Unknown Sender'
        let senderAvatar = user?.avatar_url

        if (!senderAvatar) {
          const avatarName = senderName === 'Unknown Sender' ? '?' : senderName.charAt(0).toUpperCase()
          senderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=random`
        }

        // Basic attempt to parse attachments from raw_data if content is empty/generic
        let parsedContent = msg.content
        let attachments = []
        if (!parsedContent || parsedContent === '[Hình ảnh]' || parsedContent === '[File]') { // Check for common placeholders
          try {
            const raw = msg.raw_data
            if (raw && raw.message && raw.message.attachments && Array.isArray(raw.message.attachments)) {
              attachments = raw.message.attachments.map((att: any) => ({
                type: att.type, // e.g., 'photo', 'file'
                payload: att.payload, // Contains URLs etc.
              }))
              if (attachments.length > 0 && !parsedContent) {
                parsedContent = attachments[0].type === 'photo' ? '[Hình ảnh]' : '[File]' // Set placeholder if content was truly empty
              }
            }
          }
          catch (parseError) {
            console.warn(`[Endpoint] Failed to parse attachments for msg ${msg.id}:`, parseError)
          }
        }

        return {
          id: msg.id,
          // msgId: msg.id, // Redundant if id is the same
          senderId: msg.sender_id,
          senderName,
          senderAvatar,
          content: parsedContent,
          timestamp: msg.sent_at,
          isEdited: msg.is_edited,
          attachments, // Include parsed attachments
          // raw_data: msg.raw_data, // Optionally include for debugging
        }
      })

      res.json({
        data: enrichedMessages,
      })
    }
    catch (error: any) {
      console.error('❌ [Endpoint /messages] Error:', error)
      res.status(500).json({ error: 'Failed to fetch messages', details: error.message })
    }
  })

  // Proxy avatar images to avoid CORS
  router.get('/avatar-proxy', async (req, res) => {
    try {
      const { url } = req.query

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' })
      }

      // Slightly more permissive check for Zalo domains
      const allowedDomains = [
        'https://ava-grp-talk.zadn.vn/',
        'https://s120-ava-talk.zadn.vn/',
        'https://avatar-talk.zadn.vn/', // Add other known domains if necessary
        // Add other potential Zalo CDN domains here
      ]

      if (!allowedDomains.some(domain => url.startsWith(domain))) {
        console.warn(`[Avatar Proxy] Blocked URL: ${url}`)
        return res.status(403).json({ error: 'Only allowed Zalo CDN URLs are permitted' })
      }

      // Fetch image from Zalo
      const response = await fetch(url, {
        headers: {
          // Add Referer or other headers if Zalo requires them
          // 'Referer': 'https://chat.zalo.me/' // Example - might not be needed
        },
      })

      if (!response.ok) {
        console.error(`[Avatar Proxy] Failed to fetch ${url} - Status: ${response.status}`)
        return res.status(response.status).send(`Failed to fetch image from Zalo. Status: ${response.status}`)
      }

      // Get content type and buffer
      const contentType = response.headers.get('content-type') || 'application/octet-stream' // Default if missing
      const buffer = await response.arrayBuffer()

      // Set headers and send
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=86400') // Cache for 1 day
      // eslint-disable-next-line node/prefer-global/buffer
      res.send(Buffer.from(buffer))
    }
    catch (error: any) {
      console.error('❌ [Endpoint /avatar-proxy] Error:', error)
      res.status(500).json({ error: 'Failed to proxy image', details: error.message })
    }
  })

  // --- Commented out: Manual sync route ---
  /*
  // POST /zalo/sync-group-members/:groupId - Manual sync group members
  router.post('/sync-group-members/:groupId', async (req, res) => {
    try {
      const { groupId } = req.params
      const { maxMembers = 10 } = req.body // Default to syncing a small number

      if (!groupId) {
        return res.status(400).json({ error: 'Group ID is required' })
      }

      console.warn(`[Endpoint] Manual sync members for group: ${groupId}`)

      // NOTE: Assumes getGroupInfo and manualSyncGroupMembers exist on zaloService
      // You will need to implement these in ZaloService based on zca-js capabilities
      // and update the method names here if they follow the new convention.

      // Example placeholder names (replace with actual method names):
      // const groupInfo = await zaloService.apiGetGroupInfo(groupId);
      // await zaloService.syncManualGroupMembers(groupId, groupInfo, maxMembers);

      // Placeholder response:
       return res.status(501).json({
           message: "Sync functionality not implemented in ZaloService yet.",
           groupId: groupId,
           maxMembers: maxMembers
       });

      // --- Original Logic (needs methods in ZaloService) ---
      // const groupInfo = await zaloService.apiGetGroupInfo(groupId) // Needs implementation

      // if (!groupInfo) {
      //   return res.status(404).json({ error: 'Group not found via Zalo API' })
      // }

      // await zaloService.syncManualGroupMembers(groupId, groupInfo, maxMembers) // Needs implementation

      // res.json({
      //   success: true,
      //   message: `Sync initiated for up to ${maxMembers} members for group ${groupId}`,
      //   // totalMembers: groupInfo.memVerList?.length || 0, // Get total from actual groupInfo
      // })
      // --- End Original Logic ---

    }
    catch (error: any) {
      console.error('❌ [Endpoint /sync-group-members] Error:', error)
      res.status(500).json({
        error: 'Failed to initiate sync for group members',
        details: error.message,
      })
    }
  })
  */
})
