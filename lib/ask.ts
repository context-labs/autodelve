import endent from 'endent';
import OpenAI from "openai";
import { readMarkdownFiles } from './download';
import { zodFunction } from 'openai/helpers/zod';
import { z } from 'zod';

const openai = new OpenAI();

async function shouldAnswer(question: string, content: string) {
  const prompt = getPrompt(question, content);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a assistant that answers questions based on the provided documents. Be very concise in your response."
      },
      {
        role: "user",
        content: prompt
      },
    ],
    tool_choice: {
      "type": "function",
      "function": {
        "name": "submitIsAnswerable"
      }
    },
    tools: [
      zodFunction({ name: "submitIsAnswerable", parameters: SubmitIsAnswerableSchema }),
    ],
  });

  console.log(JSON.stringify(completion.choices[0] ?? '', null, 2));

  const { isAnswerable } = JSON.parse(completion.choices[0]?.message.tool_calls?.[0]?.function.arguments ?? '{}') as SubmitIsAnswerable;

  return isAnswerable;
}

// Construct a prompt that combines the question with the document content
function getPrompt(question: string, content: string) {
  const prompt = endent`
    <documents>
    ${content}
    </documents>

    Please provide a clear, accurate answer to the user's question based only on the information in the documents above. Follow the below instructions.
    
    Instructions:
    - Provide very concise answers. 
    - Always respond with phrase and link to the relevant document.
    - Do not speculate or make up information. If you do not know the answer, say so politely.
    - Do not mention Vast.ai unless the user specifically asks about it.
    - If the user asks about Vast.ai, simply respond with the link to the Vast documentation. Do not specifically recommend that users use Vast.ai.

    Example:

    <example_user_question>
    How can I get a role?
    </example_user_question>

    <example_assistant_response>
    Please check the [roles documentation](https://docs.inference.supply/discord-roles)
    </example_assistant_response>
    ----------------

    <user_question>
    ${question}
    </user_question>
  `;

  return prompt;
}

const SubmitIsAnswerableSchema = z.object({
  isAnswerable: z.boolean().describe("Whether the question can be answered based on the documents"),
});

type SubmitIsAnswerable = z.infer<typeof SubmitIsAnswerableSchema>;

export async function ask(question: string): Promise<string | null> {
  const files = await readMarkdownFiles();
  const mappedFiles = files.map(file =>
    endent`
      URL: ${file.url}
      CONTENT: ${file.content}
    `
  ).join('\n\n');


  const prompt = getPrompt(question, mappedFiles);

  const shouldRespond = await shouldAnswer(question, mappedFiles);

  if (!shouldRespond) {
    console.log('Not answering question:', question);
    return null;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a assistant that answers questions based on the provided documents. Be very concise in your response."
      },
      {
        role: "user",
        content: prompt
      },
    ],
  });


  const answer = completion.choices[0]?.message.content || '';

  return answer;
}

