from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "Provide a 10-20 second motivational message to a runner inspired by the energy, themes, and lyrics of the song. The message should incorporate the song's vibe and spirit without directly quoting the title or too many of the lyrics. Emphasize how the song's essence can drive and energize during the run.",
        ),
        ("human", "{text}"),
    ]
)
_model = ChatOpenAI()

# if you update this, you MUST also update ../pyproject.toml
# with the new `tool.langserve.export_attr`
chain = _prompt | _model
