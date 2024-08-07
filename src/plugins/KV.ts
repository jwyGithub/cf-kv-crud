export const VALUE_TYPE = {
    TEXT: 'TEXT',
    STREAM: 'STREAM'
};

class KVController {
    private kv: KVNamespace<string>;
    constructor(kv: KVNamespace) {
        if (!kv) throw new Error('KV Namespace not found');
        this.kv = kv;
    }

    async hasKey(key: string): Promise<boolean> {
        const keys = await this.getKeys();
        return keys.includes(key);
    }

    /**
     * Adds an item to the key-value store.
     *
     * @param key - The key of the item.
     * @param value - The value of the item.
     * @param options - Optional parameters for the operation.
     * @returns A Promise that resolves when the item is successfully added.
     * @throws If an error occurs while adding the item.
     */
    async addItem(
        key: string,
        value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
        options?: KVNamespacePutOptions
    ): Promise<void> {
        try {
            if (await this.hasKey(key)) {
                throw new Error(`Key ${key} already exists`);
            }
            await this.kv.put(key, value, {
                ...options,
                expirationTtl: options?.expirationTtl ?? 60,
                expiration: options?.expiration ?? 60
            });
        } catch (error: any) {
            throw new Error(error);
        }
    }

    /**
     * Adds multiple items to the KV store.
     * @param items - An array of items to be added, each item containing a key, value, and optional options.
     * @returns A Promise that resolves when all items have been added successfully.
     * @throws If an error occurs while adding the items.
     */
    async addItems(
        items: Array<{ key: string; value: string | ArrayBuffer | ArrayBufferView | ReadableStream; options?: KVNamespacePutOptions }>
    ): Promise<void> {
        try {
            if (items.length === 0) {
                throw new Error('No items to add');
            }

            for await (const item of items) {
                await this.addItem(item.key, item.value, item.options);
            }
        } catch (error: any) {
            throw new Error(error);
        }
    }

    /**
     * Updates an item in the KV namespace.
     *
     * @param key - The key of the item to update.
     * @param value - The new value for the item.
     * @param options - Optional parameters for the update operation.
     * @returns A Promise that resolves when the update operation is complete.
     * @throws If an error occurs during the update operation.
     */
    async updateItem(
        key: string,
        value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
        options?: KVNamespacePutOptions
    ): Promise<void> {
        try {
            const { metadata } = await this.kv.getWithMetadata(key, { ...options, cacheTtl: 60 });
            await this.kv.put(key, value, { ...options, metadata });
        } catch (error: any) {
            throw new Error(error);
        }
    }

    /**
     * Retrieves the value associated with the specified key from the key-value store.
     *
     * @param key - The key to retrieve the value for.
     * @param options - Additional options for retrieving the value.
     * @returns A Promise that resolves to the value associated with the key, or `null` if the key does not exist.
     * @throws If an error occurs while retrieving the value.
     */
    async getItem<T>(key: string, ...options: any[]): Promise<{ value: T | null; valueType: string }> {
        try {
            const value = await this.kv.get<T>(key, ...options);
            const { metadata } = await this.kv.getWithMetadata<Record<string, any>>(key, { cacheTtl: 60 });
            return { value, valueType: metadata!.valueType };
        } catch (error: any) {
            throw new Error(error);
        }
    }

    /**
     * Deletes an item from the key-value store.
     *
     * @param key - The key of the item to delete.
     * @returns A Promise that resolves when the item is successfully deleted.
     * @throws If an error occurs while deleting the item.
     */
    async deleteItem(key: string): Promise<void> {
        try {
            await this.kv.delete(key);
        } catch (error: any) {
            throw new Error(error);
        }
    }

    /**
     * Deletes multiple items from the KV store.
     * @param keys - An array of keys to be deleted.
     * @returns A Promise that resolves when all items have been deleted successfully.
     * @throws If an error occurs while deleting the items.
     */
    async deleteItems(keys: string[]): Promise<void> {
        try {
            if (keys.length === 0) {
                throw new Error('No keys to delete');
            }

            for await (const key of keys) {
                await this.deleteItem(key);
            }
        } catch (error: any) {
            throw new Error(error);
        }
    }

    /**
     * Deletes all items from the KV store.
     * @returns A Promise that resolves when all items have been deleted successfully.
     * @throws If an error occurs while deleting the items.
     */
    async clear(): Promise<void> {
        try {
            const keys = await this.kv.list();
            await Promise.all(keys.keys.map(key => this.kv.delete(key.name)));
        } catch (error: any) {
            throw new Error(error);
        }
    }

    async getAll(): Promise<
        Array<{
            key: string;
            value: string | ArrayBuffer | ArrayBufferView | ReadableStream | null;
            valueType: string;
        }>
    > {
        const { keys } = await this.kv.list();

        const result: Array<{
            key: string;
            value: string | ArrayBuffer | ArrayBufferView | ReadableStream | null;
            valueType: string;
        }> = [];

        for await (const key of keys) {
            const { value, metadata } = await this.kv.getWithMetadata<Record<string, any>>(key.name, { cacheTtl: 60 });
            const valueType = metadata?.valueType ?? VALUE_TYPE.TEXT;
            result.push({
                key: key.name,
                value: valueType === VALUE_TYPE.TEXT ? value : '暂不支持查看，请下载后查看',
                valueType
            });
        }

        return result;
    }

    /**
     * Retrieves all the keys from the KV store.
     * @returns A promise that resolves to an array of strings representing the keys.
     */
    async getKeys(): Promise<string[]> {
        const { keys } = await this.kv.list();
        return keys.map(key => key.name);
    }
}

export default KVController;
