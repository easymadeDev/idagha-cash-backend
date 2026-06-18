import { proto, initAuthCreds, BufferJSON, AuthenticationState } from '@whiskeysockets/baileys';
import { Model } from 'mongoose';

export async function useMongoAuthState(model: Model<any>): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const read = async (key: string) => {
    const doc = await model.findOne({ key }).lean().exec();
    if (!doc) return null;
    return JSON.parse((doc as any).value, BufferJSON.reviver);
  };

  const write = async (key: string, value: any) => {
    const serialized = JSON.stringify(value, BufferJSON.replacer);
    await model.findOneAndUpdate({ key }, { key, value: serialized }, { upsert: true, new: true }).exec();
  };

  const creds = (await read('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await read(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }),
          );
          return data;
        },
        set: async (data: Record<string, Record<string, any>>) => {
          const tasks: Promise<void>[] = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              tasks.push(
                value
                  ? write(`${category}-${id}`, value)
                  : model.deleteOne({ key: `${category}-${id}` }).exec() as any,
              );
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => write('creds', creds),
  };
}
