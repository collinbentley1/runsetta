from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "Write a straightforward, one-liner motivational message to a runner inspired by the themes and lyrics of the song that's about to play next.",
        ),
        ("human", "{text}"),
    ]
)
_model = ChatOpenAI()

# if you update this, you MUST also update ../pyproject.toml
# with the new `tool.langserve.export_attr`
chain = _prompt | _model
