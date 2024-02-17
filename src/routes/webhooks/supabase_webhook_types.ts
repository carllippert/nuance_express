
type InsertPayload = {
    type: 'INSERT'
    table: string
    schema: string
    record: any
    old_record: null
}
type UpdatePayload = {
    type: 'UPDATE'
    table: string
    schema: string
    record: any
    old_record: any
}
type DeletePayload = {
    type: 'DELETE'
    table: string
    schema: string
    record: null
    old_record: any
}

export type Payload = InsertPayload | UpdatePayload | DeletePayload
