import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    connected_users = dict()

    async def connect(self):
        self.roomID = self.scope['url_route']['kwargs']['roomID']
        self.roomUser = self.scope['url_route']['kwargs']['userID']
        self.room_group_name = f'chat_{self.roomID}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        ChatConsumer.connected_users[self.channel_name] = self.roomUser        
        await self.accept()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'update_members',
                'memberID' : self.roomUser,
                'members': list(ChatConsumer.connected_users.values()),
                'memberType' : 'add',
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'update_members',
                'memberID' : self.roomUser,
                'memberType' : 'remove',
            }
        )
        del ChatConsumer.connected_users[self.channel_name]
        is_group_empty = await self.is_group_empty()
        if is_group_empty:
            await self.disconnect_all()

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        sendersID = text_data_json['userID']
        message = text_data_json['message']

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'userID': sendersID,
                'message': message
            }
        )

    async def update_members(self, event):
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

        
        await self.send(text_data=json.dumps(
            member_obj
        ))

    async def chat_message(self, event):
        message = event['message']
        sendersID = event['userID']
        await self.send(text_data=json.dumps({
            'userID' : sendersID,
            'message': message,
            'statusCode': 200
        }))

    async def is_group_empty(self):
        return len(ChatConsumer.connected_users) == 0

    async def disconnect_all(self):
        for channel in list(ChatConsumer.connected_users):
            await self.channel_layer.send(channel, {
                'type': 'websocket.close'
            })
        ChatConsumer.connected_users.clear()
