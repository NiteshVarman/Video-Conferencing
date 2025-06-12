const Meeting = require('../models/meeting');

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-meeting', async ({ meetingId, userId }) => {
      try {
        const meeting = await Meeting.findOne({ meetingId });
        if (!meeting) {
          socket.emit('error', { message: 'Invalid meeting ID' });
          return;
        }

        socket.join(meetingId);
        console.log(`User ${userId} joined meeting ${meetingId}`);

        const clients = Array.from(io.sockets.adapter.rooms.get(meetingId) || []).map(
          (socketId) => socketId
        );
        socket.to(meetingId).emit('user-joined', { id: socket.id, clients });
        socket.emit('user-joined', { id: socket.id, clients });
      } catch (error) {
        console.error('Error joining meeting:', error);
        socket.emit('error', { message: 'Failed to join meeting' });
      }
    });

    socket.on('offer', ({ meetingId, offer, toUserId, fromUserId }) => {
      try {
        socket.to(toUserId).emit('offer', { offer, fromUserId });
        console.log(`Offer sent from ${fromUserId} to ${toUserId} in meeting ${meetingId}`);
      } catch (error) {
        console.error('Error sending offer:', error);
        socket.emit('error', { message: 'Failed to send offer' });
      }
    });

    socket.on('answer', ({ meetingId, answer, toUserId, fromUserId }) => {
      try {
        socket.to(toUserId).emit('answer', { answer, fromUserId });
        console.log(`Answer sent from ${fromUserId} to ${toUserId} in meeting ${meetingId}`);
      } catch (error) {
        console.error('Error sending answer:', error);
        socket.emit('error', { message: 'Failed to send answer' });
      }
    });

    socket.on('ice-candidate', ({ meetingId, candidate, toUserId, fromUserId }) => {
      try {
        socket.to(toUserId).emit('ice-candidate', { candidate, fromUserId });
        console.log(`ICE candidate sent from ${fromUserId} to ${toUserId} in meeting ${meetingId}`);
      } catch (error) {
        console.error('Error sending ICE candidate:', error);
        socket.emit('error', { message: 'Failed to send ICE candidate' });
      }
    });

    socket.on('send-message', ({ meetingId, message, userId }) => {
      try {
        socket.to(meetingId).emit('receive-message', { message, userId, timestamp: Date.now() });
        socket.emit('receive-message', { message, userId, timestamp: Date.now() });
        console.log(`Message from ${userId} in meeting ${meetingId}: ${message}`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.to(room).emit('user-left', { userId: socket.id });
        }
      });
    });
  });
};

module.exports = { setupSocket };