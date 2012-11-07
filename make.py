import json
import re

import markdown
import yaml
from yaml.composer import Composer
from yaml.constructor import Constructor


def main():
    loader = yaml.Loader(open('data.yml').read())
    def compose_node(parent, index):
        # the line where the previous token ends (plus empty lines)
        line = loader.line
        node = Composer.compose_node(loader, parent, index)
        node.__line__ = line + 1
        return node
    def construct_mapping(node, deep=False):
        mapping = Constructor.construct_mapping(loader, node, deep=deep)
        mapping['__line__'] = node.__line__
        return mapping
    loader.compose_node = compose_node
    loader.construct_mapping = construct_mapping
    data = loader.get_single_data()
    output = {
        'nodes': [],
        'links': [],
    }
    layer = []
    for chunk in data['nodes']:
        layer.append([])
        for name, duration in chunk:
            output['nodes'].append({
                'name': name,
                'value': parse(duration),
            })
            layer[-1].append(name)
    divs = []
    for i, chunk in enumerate(data['links']):
        n = sum(len(_) for _ in layer[:i])
        for link in chunk:
            ref = 'line{}'.format(link['__line__'])
            divs.append('<div class="popup" id="{ref}">\n'
                '<a href="#" class="close" onclick="unselect()">[X]</a>\n'
                '{content}\n</div>'.format(
                    ref=ref,
                    content=markdown.markdown(
                        link.get('note', "No description."))))
            if link['source'] and link['target']:
                source_index = layer[i].index(link['source'][0]) + n
                target_index = (layer[i + 1].index(link['target'][0])
                    + n + len(layer[i]))
                output['links'].append({
                    'source': source_index,
                    'target': target_index,
                    'value': parse(link['duration']),
                    'source_offset': parse(link['source'][1]),
                    'target_offset': parse(link['target'][1]),
                    'ref': ref,
                })
    html = open('template.html').read()\
        .replace('{{ divs }}', '\n'.join(divs))\
        .replace('{{ data }}', json.dumps(output))
    open('index.html', 'w+').write(html)


def parse(duration):
    m = re.match(
        r'((?P<min>\d+):)?(?P<sec>\d+(\.\d+)?)',
        duration)
    if not m:
        raise ValueError(repr(duration))
    return int(m.group('min') or 0) * 60 + float(m.group('sec'))


if __name__ == '__main__':
    main()
