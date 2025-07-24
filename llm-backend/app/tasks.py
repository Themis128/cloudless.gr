from celery import Celery
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments, TextDataset, DataCollatorForLanguageModeling
import torch
import os
import logging
from app.llm_manager import load_model_path, register_model

celery_app = Celery(
    'llm_tasks',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm-tasks")

@celery_app.task
def train_model_task(model_name, train_data_path, config, owner):
    try:
        model_path = load_model_path(owner, model_name)
        output_dir = os.path.join('models', owner, f"{model_name}_finetuned")
        os.makedirs(output_dir, exist_ok=True)
        model = AutoModelForCausalLM.from_pretrained(model_path)
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        train_dataset = TextDataset(
            tokenizer=tokenizer,
            file_path=train_data_path,
            block_size=128
        )
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=tokenizer, mlm=False
        )
        training_args = TrainingArguments(
            output_dir=output_dir,
            overwrite_output_dir=True,
            num_train_epochs=config.get('epochs', 1),
            per_device_train_batch_size=config.get('batch_size', 1),
            save_steps=10_000,
            save_total_limit=2,
            logging_steps=100
        )
        trainer = Trainer(
            model=model,
            args=training_args,
            data_collator=data_collator,
            train_dataset=train_dataset
        )
        trainer.train()
        model.save_pretrained(output_dir)
        tokenizer.save_pretrained(output_dir)
        register_model(owner, output_dir)
        return {'status': 'completed', 'model': output_dir}
    except Exception as e:
        logger.error(f"Training failed for {owner}/{model_name}: {e}", exc_info=True)
        return {'status': 'failed', 'error': str(e)}

@celery_app.task
def infer_task(model_name, prompt, owner):
    try:
        model_path = load_model_path(owner, model_name)
        model = AutoModelForCausalLM.from_pretrained(model_path)
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        input_ids = tokenizer.encode(prompt, return_tensors="pt")
        with torch.no_grad():
            output = model.generate(input_ids, max_length=128, num_return_sequences=1)
        result = tokenizer.decode(output[0], skip_special_tokens=True)
        return {'status': 'completed', 'output': result}
    except Exception as e:
        logger.error(f"Inference failed for {owner}/{model_name}: {e}", exc_info=True)
        return {'status': 'failed', 'error': str(e)} 