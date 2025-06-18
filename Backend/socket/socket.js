const Meeting = require("../models/meeting")

const setupSocket = (io) => {
  const userMap = new Map()
  const mediaStates = new Map() 

  io.on("connection", (socket) => {
    console.log("Connected:", socket.id)

    socket.on("join-meeting", async ({ meetingId, userId, videoEnabled = true, audioEnabled = true }) => {
      try {
        const meeting = await Meeting.findOne({ meetingId })
        if (!meeting) {
          socket.emit("error", { message: "Invalid meeting ID" })
          return
        }

        socket.join(meetingId)
        userMap.set(socket.id, { userId, meetingId }) // Store both userId and meetingId

        // Initialize media states for this meeting if not exists
        if (!mediaStates.has(meetingId)) {
          mediaStates.set(meetingId, {
            video: new Map(),
            audio: new Map(),
          })
        }

        // Set initial media states for this user
        const meetingMediaStates = mediaStates.get(meetingId)
        meetingMediaStates.video.set(socket.id, videoEnabled)
        meetingMediaStates.audio.set(socket.id, audioEnabled)

        console.log(
          `User ${userId} (ID: ${socket.id}) joined meeting ${meetingId} with video: ${videoEnabled}, audio: ${audioEnabled}`,
        )

        const clients = Array.from(io.sockets.adapter.rooms.get(meetingId) || [])

        // Create user map for this specific meeting
        const meetingUserMap = {}
        clients.forEach((clientId) => {
          const userData = userMap.get(clientId)
          if (userData && userData.meetingId === meetingId) {
            meetingUserMap[clientId] = userData.userId
          }
        })

        // Convert media states to objects for transmission
        const mediaStatesObj = {
          video: Object.fromEntries(meetingMediaStates.video),
          audio: Object.fromEntries(meetingMediaStates.audio),
        }

        // Send current media states to the joining user
        socket.emit("user-media-states", { mediaStates: mediaStatesObj })

        // Notify all users in the meeting about the new user
        io.in(meetingId).emit("user-joined", {
          id: socket.id,
          clients,
          userMap: meetingUserMap,
          mediaStates: mediaStatesObj,
        })

        console.log(`Clients in ${meetingId}: ${clients}, UserMap:`, meetingUserMap)
        console.log(`Media states for ${meetingId}:`, mediaStatesObj)
      } catch (error) {
        console.error("Error joining meeting:", error)
        socket.emit("error", { message: "Failed to join meeting" })
      }
    })

    socket.on("media-state-change", ({ meetingId, userId, videoEnabled, audioEnabled }) => {
      try {
        if (!mediaStates.has(meetingId)) {
          console.error(`No media states found for meeting ${meetingId}`)
          return
        }

        const meetingMediaStates = mediaStates.get(meetingId)
        meetingMediaStates.video.set(userId, videoEnabled)
        meetingMediaStates.audio.set(userId, audioEnabled)

        console.log(`Media state change for ${userId} in ${meetingId}: video=${videoEnabled}, audio=${audioEnabled}`)

        // Broadcast the media state change to all other users in the meeting
        socket.to(meetingId).emit("media-state-change", {
          userId,
          videoEnabled,
          audioEnabled,
        })
      } catch (error) {
        console.error("Error handling media state change:", error)
      }
    })

    socket.on("offer", ({ meetingId, offer, toId, fromId }) => {
      try {
        if (!toId || !fromId) {
          console.error(`Invalid offer: toId=${toId}, fromId=${fromId}`)
          socket.emit("error", { message: "Invalid offer parameters" })
          return
        }
        socket.to(toId).emit("offer", { offer, fromId })
        console.log(`Offer from ${fromId} to ${toId} in ${meetingId}`)
      } catch (error) {
        console.error("Error sending offer:", error)
        socket.emit("error", { message: "Failed to send offer" })
      }
    })

    socket.on("answer", ({ meetingId, answer, toId, fromId }) => {
      try {
        if (!toId || !fromId) {
          console.error(`Invalid answer: toId=${toId}, fromId=${fromId}`)
          socket.emit("error", { message: "Invalid answer parameters" })
          return
        }
        socket.to(toId).emit("answer", { answer, fromId })
        console.log(`Answer from ${fromId} to ${toId} in ${meetingId}`)
      } catch (error) {
        console.error("Error sending answer:", error)
        socket.emit("error", { message: "Failed to send answer" })
      }
    })

    socket.on("ice-candidate", ({ meetingId, candidate, toId, fromId }) => {
      try {
        if (!toId || !fromId) {
          console.error(`Invalid ICE candidate: toId=${toId}, fromId=${fromId}`)
          socket.emit("error", { message: "Invalid ICE candidate parameters" })
          return
        }
        socket.to(toId).emit("ice-candidate", { candidate, fromId })
        console.log(`ICE candidate from ${fromId} to ${toId} in ${meetingId}`)
      } catch (error) {
        console.error("Error sending ICE candidate:", error)
        socket.emit("error", { message: "Failed to send ICE candidate" })
      }
    })

    socket.on("send-message", ({ meetingId, message, userId }) => {
      try {
        io.in(meetingId).emit("receive-message", { message, userId, timestamp: Date.now() })
        console.log(`Message from ${userId} in ${meetingId}: ${message}`)
      } catch (error) {
        console.error("Error sending message:", error)
        socket.emit("error", { message: "Failed to send message" })
      }
    })

    socket.on("disconnect", () => {
      const userData = userMap.get(socket.id)
      const userId = userData ? userData.userId : socket.id
      const meetingId = userData ? userData.meetingId : null

      console.log(`Disconnected: ${socket.id}, Username: ${userId}, Meeting: ${meetingId}`)

      // Clean up user from userMap
      userMap.delete(socket.id)

      if (meetingId) {
        // Clean up media states for this specific meeting
        if (mediaStates.has(meetingId)) {
          const meetingMediaStates = mediaStates.get(meetingId)
          meetingMediaStates.video.delete(socket.id)
          meetingMediaStates.audio.delete(socket.id)

          // Get remaining clients in the meeting
          const remainingClients = io.sockets.adapter.rooms.get(meetingId)

          if (!remainingClients || remainingClients.size === 0) {
            // No users left in meeting, clean up the meeting's media states
            mediaStates.delete(meetingId)
            console.log(`Cleaned up media states for empty meeting: ${meetingId}`)
          } else {
            // Update user map and media states for remaining clients
            const updatedMeetingUserMap = {}
            const remainingClientIds = Array.from(remainingClients)

            remainingClientIds.forEach((clientId) => {
              const clientData = userMap.get(clientId)
              if (clientData && clientData.meetingId === meetingId) {
                updatedMeetingUserMap[clientId] = clientData.userId
              }
            })

            // Convert updated media states to objects for transmission
            const updatedMediaStatesObj = {
              video: Object.fromEntries(meetingMediaStates.video),
              audio: Object.fromEntries(meetingMediaStates.audio),
            }

            // Notify remaining users in the meeting with updated data
            io.in(meetingId).emit("user-left", {
              id: socket.id,
              updatedUserMap: updatedMeetingUserMap,
              updatedMediaStates: updatedMediaStatesObj,
              remainingClients: remainingClientIds,
            })

            console.log(`Notified ${meetingId} of user-left: ${socket.id}`)
            console.log(`Updated user map:`, updatedMeetingUserMap)
            console.log(`Remaining clients: ${remainingClientIds.length}`)
          }
        }
      } else {
        // Fallback: notify all rooms the socket was in
        socket.rooms.forEach((room) => {
          if (room !== socket.id) {
            io.in(room).emit("user-left", { id: socket.id })
            console.log(`Notified ${room} of user-left: ${socket.id} (fallback)`)
          }
        })
      }
    })
  })
}

module.exports = { setupSocket }
