import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.exceptions import StopConsumer
import logging

logger = logging.getLogger(__name__)

class ChatConsumer(AsyncWebsocketConsumer):
    connected_users = dict()

    async def connect(self):
        try:
            self.roomID = self.scope['url_route']['kwargs']['roomID']
            self.roomUser = self.scope['url_route']['kwargs']['userID']
            self.room_group_name = f'chat_{self.roomID}'

            # Join room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )

            # Store user information
            ChatConsumer.connected_users[self.channel_name] = self.roomUser
            
            # Accept the connection
            await self.accept()

            # Notify about new member
            try:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'update_members',
                        'memberID': self.roomUser,
                        'members': list(ChatConsumer.connected_users.values()),
                        'memberType': 'add',
                    }
                )
            except Exception as e:
                logger.error(f"Error sending group message: {str(e)}")

        except Exception as e:
            logger.error(f"Error in connect: {str(e)}")
            await self.close()

    async def disconnect(self, close_code):
        try:
            # Leave room group
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

            # Notify about member removal
            if self.channel_name in ChatConsumer.connected_users:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'update_members',
                        'memberID': self.roomUser,
                        'memberType': 'remove',
                    }
                )
                
                del ChatConsumer.connected_users[self.channel_name]

                # Check if group is empty
                is_group_empty = await self.is_group_empty()
                if is_group_empty:
                    await self.disconnect_all()

        except Exception as e:
            logger.error(f"Error in disconnect: {str(e)}")
        finally:
            raise StopConsumer()

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            sendersID = text_data_json['userID']
            message = text_data_json['message']

            # Send message to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'userID': sendersID,
                    'message': message
                }
            )
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except KeyError as e:
            logger.error(f"Missing required field in message: {str(e)}")
        except Exception as e:
            logger.error(f"Error in receive: {str(e)}")

    async def update_members(self, event):
        try:
            memberID = event['memberID']
            memberType = event['memberType']

            match memberType:
                case 'add':
                    new_memberList = event['members']
                    member_obj = {
                        'new_member': memberID,
                        'new_memberList': new_memberList,
                        'statusCode': 204
                    }
                case 'remove':
                    member_obj = {
                        'removed_member': memberID,
                        'statusCode': 206
                    }

            await self.send(text_data=json.dumps(member_obj))
            
        except Exception as e:
            logger.error(f"Error in update_members: {str(e)}")

    async def chat_message(self, event):
        try:
            message = event['message']
            sendersID = event['userID']
            
            await self.send(text_data=json.dumps({
                'userID': sendersID,
                'message': message,
                'statusCode': 200
            }))
        except Exception as e:
            logger.error(f"Error in chat_message: {str(e)}")

    async def is_group_empty(self):
        try:
            return len(ChatConsumer.connected_users) == 0
        except Exception as e:
            logger.error(f"Error checking if group is empty: {str(e)}")
            return True

    async def disconnect_all(self):
        try:
            for channel in list(ChatConsumer.connected_users):
                try:
                    await self.channel_layer.send(channel, {
                        'type': 'websocket.close'
                    })
                except Exception as e:
                    logger.error(f"Error closing channel {channel}: {str(e)}")
            
            ChatConsumer.connected_users.clear()
        except Exception as e:
            logger.error(f"Error in disconnect_all: {str(e)}")
