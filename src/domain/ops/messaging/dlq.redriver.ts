export interface IRedriveResult {
  taskHandle?: string;
}

// Redrive port: the domain requests a DLQ redrive without knowing the queue
// technology (implemented by SqsDlqRedriver in infrastructure/messaging).
export interface IDlqRedriver {
  redrive(): Promise<IRedriveResult>;
}
