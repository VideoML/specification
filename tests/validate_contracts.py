#!/usr/bin/env python3
"""Schema acceptance and typed rejection fixtures; requires jsonschema 4.25.1."""
import copy
import json
from pathlib import Path
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
def load(path):
    return json.loads(path.read_text())
def validate(name, value):
    schema = load(ROOT / 'schemas' / (name + '.schema.json'))
    Draft202012Validator.check_schema(schema)
    return list(Draft202012Validator(schema).iter_errors(value))

cases = {'effect-descriptor-scene-snapshot': 'effect-descriptor', 'speech-capabilities': 'speech-response', 'speech-capabilities-request': 'speech-request', 'resolved-timing-paid': 'resolved-timing', 'resolved-timing-dry-run': 'resolved-timing', 'resolved-timing-visual-only': 'resolved-timing'}
for example in sorted((ROOT / 'examples/contracts').glob('*.json')):
    name = cases.get(example.stem, example.stem)
    errors = validate(name, load(example))
    assert not errors, (example.name, [e.message for e in errors])

for name, changes in {
    'portable-bundle': [('schemaVersion', 2), ('entry', '../escape.xml'), ('width', '1920'), ('entry', '/absolute')],
    'effect-config': [('startFrame', -1), ('parameters', 'not-object')],
    'speech-request': [('protocol', 2), ('speed', 'fast'), ('seed', -1)],
    'speech-response': [('protocol', 2), ('ok', 'true')],
    'voiceover-config': [('sampleRateHz', 0), ('seed', 'anything'), ('speed', -1)],
    'resolved-timing': [('schemaVersion', 2), ('fps', 0)]
}.items():
    example = load(ROOT / 'examples/contracts' / (name + '.json'))
    for field, bad in changes:
        mutated = copy.deepcopy(example)
        mutated[field] = bad
        assert validate(name, mutated), (name, field, bad)
for name, mutate in [
    ('effect-descriptor-scene-snapshot', lambda x: x['sceneInputs'][0].pop('frameParameter')),
    ('effect-descriptor-scene-snapshot', lambda x: x['sceneInputs'][0].update(sceneIdParameter='constructor')),
    ('effect-descriptor-scene-snapshot', lambda x: x.update(sceneInputs=x['sceneInputs']*5)),
    ('effect-descriptor-scene-snapshot', lambda x: x.update(sceneInputs=x['sceneInputs']*2)),
    ('dependency-lock', lambda x: x['dependencies'].__setitem__('player@^1.0.0', 'sha256:' + 'a' * 64)),
    ('dependency-lock', lambda x: x['fonts'].__setitem__('font', 'sha256:bad')),
    ('dependency-lock', lambda x: x['fonts'].__setitem__('constructor', 'sha256:' + 'a' * 64)),
    ('portable-bundle', lambda x: x['composition'].update(normalizedSource='source/normalized.json', sourceClosure=['source/main.ts'], browserBundle=None, customComponents=[{'id':'Custom','version':'1'}])),
    ('portable-bundle', lambda x: x['composition'].update(customEffects=[{'id':'custom/x','version':'1','sceneInputs':[]}])) ,
    ('portable-bundle', lambda x: x['composition'].update(normalizedSource='source/normalized.json', sourceClosure=['source/main.ts'], browserBundle='script/browser.js', customComponents=[], customEffects=[{'id':'custom/x','version':'1','sceneInputs':[{'sceneIdParameter':'constructor','frameParameter':'frame'}]}])),
    ('portable-bundle', lambda x: x.pop('composition')),
    ('portable-bundle', lambda x: x['composition'].pop('script')),
    ('portable-bundle', lambda x: x['composition'].pop('id')),
    ('speech-response', lambda x: x['result'].pop('pcmSha256')),
    ('speech-response', lambda x: x['result']['provenance'].pop('requestKey')),
    ('resolved-timing', lambda x: x.pop('scenes')),
    ('resolved-timing', lambda x: x.pop('audioTotalSamples')),
    ('resolved-timing', lambda x: x.update(audioTotalSamples=-1)),
    ('resolved-timing', lambda x: x['segments'][0]['provenance'].update(simulated=True)),
    ('resolved-timing-dry-run', lambda x: x['segments'][0]['provenance'].update(simulated=False)),
]:
    item = load(ROOT / 'examples/contracts' / (name + '.json'))
    mutate(item)
    assert validate(cases.get(name, name), item), name
print('14 positive examples and 36 negative mutations passed')
